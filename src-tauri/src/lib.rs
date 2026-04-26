// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use once_cell::sync::Lazy;
use printpdf::{BuiltinFont, Mm, PdfDocument, PdfDocumentReference, PdfLayerReference};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    fs::File,
    io::BufWriter,
    path::{Path, PathBuf},
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

const A4_WIDTH_MM: f32 = 210.0;
const A4_HEIGHT_MM: f32 = 297.0;
const PAGE_MARGIN_MM: f32 = 18.0;
const PAGE_TOP_MM: f32 = A4_HEIGHT_MM - PAGE_MARGIN_MM;
const PAGE_BOTTOM_MM: f32 = PAGE_MARGIN_MM;
const LINE_HEIGHT_FACTOR: f32 = 1.45;

static ORDERED_LIST_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(\d+)[\.)]\s+(.*)$").expect("ordered list regex"));

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportPdfRequest {
    title: Option<String>,
    markdown: String,
    output_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveImageForDocumentRequest {
    doc_path: String,
    original_name: String,
    media_type: Option<String>,
    bytes: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedImageResponse {
    file_name: String,
    markdown_path: String,
    absolute_path: String,
}

#[derive(Clone, Copy)]
enum FontKind {
    Regular,
    Bold,
    Mono,
}

struct PdfFonts {
    regular: printpdf::IndirectFontRef,
    bold: printpdf::IndirectFontRef,
    mono: printpdf::IndirectFontRef,
}

struct PdfRenderer {
    document: PdfDocumentReference,
    layer: PdfLayerReference,
    fonts: PdfFonts,
    cursor_y_mm: f32,
}

#[tauri::command]
fn export_pdf(request: ExportPdfRequest) -> Result<(), String> {
    let output_path = normalize_pdf_path(&request.output_path);
    let parent = output_path
        .parent()
        .ok_or_else(|| "Invalid PDF export path".to_string())?;

    if !parent.exists() {
        return Err("The selected export folder does not exist.".to_string());
    }

    let title = request
        .title
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("LibreMD Export");

    let (document, page, layer) = PdfDocument::new(
        title,
        Mm(A4_WIDTH_MM),
        Mm(A4_HEIGHT_MM),
        "Page 1",
    );

    let fonts = PdfFonts {
        regular: document
            .add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|err| format!("Failed to load PDF font: {err}"))?,
        bold: document
            .add_builtin_font(BuiltinFont::HelveticaBold)
            .map_err(|err| format!("Failed to load PDF font: {err}"))?,
        mono: document
            .add_builtin_font(BuiltinFont::Courier)
            .map_err(|err| format!("Failed to load PDF font: {err}"))?,
    };

    let initial_layer = document.get_page(page).get_layer(layer);

    let mut renderer = PdfRenderer {
        document,
        layer: initial_layer,
        fonts,
        cursor_y_mm: PAGE_TOP_MM,
    };

    render_markdown_to_pdf(&mut renderer, title, &request.markdown)?;

    let file = File::create(&output_path)
        .map_err(|err| format!("Failed to create PDF file '{}': {err}", output_path.display()))?;
    renderer
        .document
        .save(&mut BufWriter::new(file))
        .map_err(|err| format!("Failed to save PDF file: {err}"))?;

    Ok(())
}

#[tauri::command]
fn save_image_for_document(request: SaveImageForDocumentRequest) -> Result<SavedImageResponse, String> {
    if request.bytes.is_empty() {
        return Err("The selected image is empty.".to_string());
    }

    let doc_path = PathBuf::from(&request.doc_path);
    let doc_directory = doc_path
        .parent()
        .ok_or_else(|| "Invalid document path".to_string())?;

    if !doc_directory.exists() {
        return Err("The document folder does not exist.".to_string());
    }

    let images_directory = doc_directory.join("images");
    fs::create_dir_all(&images_directory)
        .map_err(|err| format!("Failed to create images directory: {err}"))?;

    let base_name = sanitize_image_base_name(&request.original_name);
    let extension = infer_image_extension(&request.original_name, request.media_type.as_deref());
    let file_name = create_unique_image_filename(&images_directory, &base_name, &extension)?;
    let destination_path = images_directory.join(&file_name);

    fs::write(&destination_path, &request.bytes)
        .map_err(|err| format!("Failed to write image file: {err}"))?;

    Ok(SavedImageResponse {
        file_name: file_name.clone(),
        markdown_path: format!("./images/{file_name}"),
        absolute_path: destination_path.to_string_lossy().to_string(),
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolveImageRequest {
    doc_path: String,
    image_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ResolveImageResponse {
    data_url: String,
}

#[tauri::command]
fn resolve_image(request: ResolveImageRequest) -> Result<ResolveImageResponse, String> {
    let doc_path = PathBuf::from(&request.doc_path);
    let doc_directory = doc_path
        .parent()
        .ok_or_else(|| "Invalid document path".to_string())?;

    let relative = request.image_path.trim_start_matches("./").trim_start_matches(".\\");
    let image_path = doc_directory.join(relative);

    let bytes = fs::read(&image_path)
        .map_err(|err| format!("Failed to read image file '{}': {}", image_path.display(), err))?;

    let mime = mime_type_from_path(&image_path);
    let base64 = base64_encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime, base64);

    Ok(ResolveImageResponse { data_url })
}

fn mime_type_from_path(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    use std::char;
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b = match chunk.len() {
            1 => [chunk[0], 0, 0],
            2 => [chunk[0], chunk[1], 0],
            _ => [chunk[0], chunk[1], chunk[2]],
        };
        out.push(TABLE[(b[0] >> 2) as usize] as char);
        out.push(TABLE[(((b[0] & 0x03) << 4) | (b[1] >> 4)) as usize] as char);
        out.push(TABLE[(((b[1] & 0x0F) << 2) | (b[2] >> 6)) as usize] as char);
        out.push(TABLE[(b[2] & 0x3F) as usize] as char);
    }
    match bytes.len() % 3 {
        1 => { out.pop(); out.pop(); out.push_str("=="); }
        2 => { out.pop(); out.push('='); }
        _ => {}
    }
    out
}

fn normalize_pdf_path(path: &str) -> PathBuf {
    let candidate = PathBuf::from(path);

    match candidate.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("pdf") => candidate,
        _ => candidate.with_extension("pdf"),
    }
}

fn sanitize_image_base_name(file_name: &str) -> String {
    let raw_name = Path::new(file_name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or_default()
        .trim()
        .to_lowercase();

    let mut sanitized = String::with_capacity(raw_name.len());
    let mut previous_was_dash = false;

    for ch in raw_name.chars() {
        let allowed = ch.is_ascii_lowercase() || ch.is_ascii_digit() || matches!(ch, '.' | '_' | '-');
        if allowed {
            sanitized.push(ch);
            previous_was_dash = false;
            continue;
        }

        if !previous_was_dash {
            sanitized.push('-');
            previous_was_dash = true;
        }
    }

    let trimmed = sanitized.trim_matches(|ch| matches!(ch, '-' | '.' | '_')).to_string();
    if trimmed.is_empty() { "image".to_string() } else { trimmed }
}

fn infer_image_extension(original_name: &str, media_type: Option<&str>) -> String {
    if let Some(ext) = Path::new(original_name).extension().and_then(|ext| ext.to_str()) {
        let clean = ext.trim().trim_start_matches('.').to_ascii_lowercase();
        if !clean.is_empty() && clean.chars().all(|ch| ch.is_ascii_alphanumeric()) {
            return format!(".{clean}");
        }
    }

    match media_type.unwrap_or_default().to_ascii_lowercase().as_str() {
        "image/jpeg" | "image/jpg" => ".jpg".to_string(),
        "image/gif" => ".gif".to_string(),
        "image/webp" => ".webp".to_string(),
        "image/svg+xml" => ".svg".to_string(),
        "image/bmp" => ".bmp".to_string(),
        "image/x-icon" | "image/vnd.microsoft.icon" => ".ico".to_string(),
        _ => ".png".to_string(),
    }
}

fn create_unique_image_filename(images_directory: &Path, base_name: &str, extension: &str) -> Result<String, String> {
    for index in 0..10_000 {
        let suffix = if index == 0 {
            String::new()
        } else {
            format!("-{}", index + 1)
        };
        let candidate = format!("{base_name}{suffix}{extension}");
        let candidate_path = images_directory.join(&candidate);
        if !candidate_path.exists() {
            return Ok(candidate);
        }
    }

    Err("Failed to allocate a unique image filename.".to_string())
}

fn render_markdown_to_pdf(renderer: &mut PdfRenderer, title: &str, markdown: &str) -> Result<(), String> {
    let sanitized_title = sanitize_inline_text(title);
    renderer.write_wrapped_block(
        &sanitized_title,
        20.0,
        FontKind::Bold,
        0.0,
        0.0,
        8.0,
    );

    let mut paragraph_lines: Vec<String> = Vec::new();
    let mut code_lines: Vec<String> = Vec::new();
    let mut in_code_block = false;

    for raw_line in markdown.lines() {
        let line = raw_line.trim_end();
        let trimmed = line.trim();

        if trimmed.starts_with("```") {
            flush_paragraph(renderer, &mut paragraph_lines);

            if in_code_block {
                flush_code_block(renderer, &mut code_lines);
            } else if !code_lines.is_empty() {
                code_lines.clear();
            }

            in_code_block = !in_code_block;
            continue;
        }

        if in_code_block {
            code_lines.push(line.to_string());
            continue;
        }

        if trimmed.is_empty() {
            flush_paragraph(renderer, &mut paragraph_lines);
            continue;
        }

        if let Some((level, text)) = parse_heading(trimmed) {
            flush_paragraph(renderer, &mut paragraph_lines);
            render_heading(renderer, level, text);
            continue;
        }

        if is_horizontal_rule(trimmed) {
            flush_paragraph(renderer, &mut paragraph_lines);
            renderer.write_wrapped_block("", 12.0, FontKind::Regular, 0.0, 3.0, 3.0);
            continue;
        }

        if let Some((prefix, text)) = parse_list_item(trimmed) {
            flush_paragraph(renderer, &mut paragraph_lines);
            render_list_item(renderer, &prefix, &text);
            continue;
        }

        if let Some(text) = trimmed.strip_prefix('>') {
            flush_paragraph(renderer, &mut paragraph_lines);
            render_blockquote(renderer, text.trim());
            continue;
        }

        if looks_like_table(trimmed) {
            flush_paragraph(renderer, &mut paragraph_lines);
            render_table_line(renderer, trimmed);
            continue;
        }

        paragraph_lines.push(trimmed.to_string());
    }

    flush_paragraph(renderer, &mut paragraph_lines);
    flush_code_block(renderer, &mut code_lines);

    if in_code_block {
        return Err("PDF export failed because the document contains an unclosed code fence.".to_string());
    }

    Ok(())
}

fn flush_paragraph(renderer: &mut PdfRenderer, paragraph_lines: &mut Vec<String>) {
    if paragraph_lines.is_empty() {
        return;
    }

    let paragraph = sanitize_inline_text(&paragraph_lines.join(" "));
    renderer.write_wrapped_block(&paragraph, 12.0, FontKind::Regular, 0.0, 0.0, 5.0);
    paragraph_lines.clear();
}

fn flush_code_block(renderer: &mut PdfRenderer, code_lines: &mut Vec<String>) {
    if code_lines.is_empty() {
        return;
    }

    for line in code_lines.iter() {
        let text = if line.trim().is_empty() {
            " ".to_string()
        } else {
            sanitize_preformatted_text(line)
        };

        renderer.write_wrapped_block(&text, 10.0, FontKind::Mono, 3.0, 0.0, 0.0);
    }

    renderer.write_wrapped_block("", 10.0, FontKind::Mono, 0.0, 2.0, 4.0);
    code_lines.clear();
}

fn parse_heading(line: &str) -> Option<(usize, &str)> {
    let hashes = line.chars().take_while(|ch| *ch == '#').count();
    if hashes == 0 || hashes > 6 {
        return None;
    }

    let content = line[hashes..].trim();
    if content.is_empty() {
        return None;
    }

    Some((hashes, content))
}

fn render_heading(renderer: &mut PdfRenderer, level: usize, text: &str) {
    let size = match level {
        1 => 18.0,
        2 => 16.0,
        3 => 14.0,
        4 => 13.0,
        _ => 12.0,
    };

    renderer.write_wrapped_block(&sanitize_inline_text(text), size, FontKind::Bold, 0.0, 4.0, 4.0);
}

fn is_horizontal_rule(line: &str) -> bool {
    matches!(line, "---" | "***" | "___")
}

fn parse_list_item(line: &str) -> Option<(String, String)> {
    for marker in ["- ", "* ", "+ "] {
        if let Some(content) = line.strip_prefix(marker) {
            return Some(("-".to_string(), content.trim().to_string()));
        }
    }

    ORDERED_LIST_RE.captures(line).map(|captures| {
        let number = captures.get(1).map(|value| value.as_str()).unwrap_or("1");
        let content = captures.get(2).map(|value| value.as_str()).unwrap_or("");
        (format!("{number}."), content.trim().to_string())
    })
}

fn render_list_item(renderer: &mut PdfRenderer, prefix: &str, text: &str) {
    let wrapped = wrap_lines(
        &sanitize_inline_text(text),
        renderer.max_chars_for(12.0, 10.0),
        Some(prefix),
        Some("   "),
    );

    for line in wrapped {
        renderer.write_line(&line, 12.0, FontKind::Regular, 10.0, 0.0);
    }

    renderer.add_spacing(3.0);
}

fn render_blockquote(renderer: &mut PdfRenderer, text: &str) {
    let wrapped = wrap_lines(
        &sanitize_inline_text(text),
        renderer.max_chars_for(11.0, 10.0),
        Some("> "),
        Some("  "),
    );

    for line in wrapped {
        renderer.write_line(&line, 11.0, FontKind::Regular, 10.0, 0.0);
    }

    renderer.add_spacing(3.0);
}

fn looks_like_table(line: &str) -> bool {
    line.contains('|')
}

fn render_table_line(renderer: &mut PdfRenderer, text: &str) {
    if text.chars().all(|ch| matches!(ch, '|' | '-' | ':' | ' ')) {
        return;
    }

    renderer.write_wrapped_block(&sanitize_preformatted_text(text), 10.0, FontKind::Mono, 4.0, 0.0, 0.0);
}

fn sanitize_inline_text(text: &str) -> String {
    text.chars()
        .map(|ch| match ch {
            '“' | '”' => '"',
            '‘' | '’' => '\'',
            '—' | '–' => '-',
            '\t' => ' ',
            ch if ch.is_ascii() && !ch.is_control() => ch,
            '\n' | '\r' => ' ',
            _ => '?',
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn sanitize_preformatted_text(text: &str) -> String {
    text.chars()
        .map(|ch| match ch {
            '“' | '”' => '"',
            '‘' | '’' => '\'',
            '—' | '–' => '-',
            '\t' => ' ',
            ch if ch.is_ascii() && !matches!(ch, '\n' | '\r') && !ch.is_control() => ch,
            _ => '?',
        })
        .collect()
}

fn wrap_lines(text: &str, max_chars: usize, first_prefix: Option<&str>, rest_prefix: Option<&str>) -> Vec<String> {
    let first_prefix = first_prefix.unwrap_or("");
    let rest_prefix = rest_prefix.unwrap_or(first_prefix);
    let first_limit = max_chars.saturating_sub(first_prefix.chars().count()).max(1);
    let rest_limit = max_chars.saturating_sub(rest_prefix.chars().count()).max(1);
    let mut lines = Vec::new();
    let mut current = String::new();
    let mut limit = first_limit;
    let mut prefix = first_prefix;

    for word in text.split_whitespace() {
        if current.is_empty() {
            if word.chars().count() > limit {
                for chunk in chunk_word(word, limit) {
                    lines.push(format!("{prefix}{chunk}"));
                    prefix = rest_prefix;
                    limit = rest_limit;
                }
            } else {
                current.push_str(word);
            }
            continue;
        }

        let projected = current.chars().count() + 1 + word.chars().count();
        if projected <= limit {
            current.push(' ');
            current.push_str(word);
            continue;
        }

        lines.push(format!("{prefix}{current}"));
        prefix = rest_prefix;
        limit = rest_limit;
        current.clear();

        if word.chars().count() > limit {
            for chunk in chunk_word(word, limit) {
                lines.push(format!("{prefix}{chunk}"));
            }
        } else {
            current.push_str(word);
        }
    }

    if !current.is_empty() {
        lines.push(format!("{prefix}{current}"));
    } else if lines.is_empty() {
        lines.push(first_prefix.to_string());
    }

    lines
}

fn chunk_word(word: &str, chunk_size: usize) -> Vec<String> {
    if chunk_size == 0 {
        return vec![word.to_string()];
    }

    let chars = word.chars().collect::<Vec<_>>();
    chars
        .chunks(chunk_size)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect()
}

impl PdfRenderer {
    fn max_chars_for(&self, font_size_pt: f32, indent_mm: f32) -> usize {
        let content_width_mm = (A4_WIDTH_MM - (PAGE_MARGIN_MM * 2.0) - indent_mm).max(40.0);
        let content_width_pt = content_width_mm / 0.352_778;
        ((content_width_pt / (font_size_pt * 0.52)).floor() as usize).max(12)
    }

    fn write_wrapped_block(
        &mut self,
        text: &str,
        font_size_pt: f32,
        font_kind: FontKind,
        indent_mm: f32,
        top_spacing_mm: f32,
        bottom_spacing_mm: f32,
    ) {
        self.add_spacing(top_spacing_mm);

        let lines = wrap_lines(text, self.max_chars_for(font_size_pt, indent_mm), None, None);
        for line in lines {
            self.write_line(&line, font_size_pt, font_kind, indent_mm, 0.0);
        }

        self.add_spacing(bottom_spacing_mm);
    }

    fn write_line(
        &mut self,
        text: &str,
        font_size_pt: f32,
        font_kind: FontKind,
        indent_mm: f32,
        extra_spacing_mm: f32,
    ) {
        let line_height_mm = pt_to_mm(font_size_pt * LINE_HEIGHT_FACTOR);
        self.ensure_space(line_height_mm + extra_spacing_mm);

        let font = match font_kind {
            FontKind::Regular => &self.fonts.regular,
            FontKind::Bold => &self.fonts.bold,
            FontKind::Mono => &self.fonts.mono,
        };

        self.layer.use_text(
            text,
            font_size_pt,
            Mm(PAGE_MARGIN_MM + indent_mm),
            Mm(self.cursor_y_mm),
            font,
        );

        self.cursor_y_mm -= line_height_mm + extra_spacing_mm;
    }

    fn add_spacing(&mut self, spacing_mm: f32) {
        if spacing_mm > 0.0 {
            self.ensure_space(spacing_mm);
            self.cursor_y_mm -= spacing_mm;
        }
    }

    fn ensure_space(&mut self, required_mm: f32) {
        if self.cursor_y_mm - required_mm >= PAGE_BOTTOM_MM {
            return;
        }

        let (page, layer) = self
            .document
            .add_page(Mm(A4_WIDTH_MM), Mm(A4_HEIGHT_MM), "Continued Page");
        self.layer = self.document.get_page(page).get_layer(layer);
        self.cursor_y_mm = PAGE_TOP_MM;
    }
}

fn pt_to_mm(points: f32) -> f32 {
    points * 0.352_778
}

#[cfg(test)]
mod tests {
    use super::{
        create_unique_image_filename, export_pdf, infer_image_extension, sanitize_image_base_name,
        save_image_for_document, ExportPdfRequest, SaveImageForDocumentRequest,
    };
    use std::{fs, time::{SystemTime, UNIX_EPOCH}};

    #[test]
    fn export_pdf_writes_a_real_pdf_file() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("valid time")
            .as_nanos();
        let output_path = std::env::temp_dir().join(format!("libremd-export-test-{unique}.pdf"));

        let request = ExportPdfRequest {
            title: Some("Export Test".to_string()),
            markdown: "# Heading\n\nThis is a PDF export smoke test.\n\n- First\n- Second".to_string(),
            output_path: output_path.to_string_lossy().to_string(),
        };

        export_pdf(request).expect("pdf export succeeds");

        let bytes = fs::read(&output_path).expect("pdf file exists");
        assert!(bytes.starts_with(b"%PDF-"), "expected generated file to start with a PDF header");

        let _ = fs::remove_file(output_path);
    }

    #[test]
    fn image_import_sanitizes_and_writes_inside_images_folder() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("valid time")
            .as_nanos();
        let doc_directory = std::env::temp_dir().join(format!("libremd-image-test-{unique}"));
        fs::create_dir_all(&doc_directory).expect("temp doc dir");

        let doc_path = doc_directory.join("notes.md");
        fs::write(&doc_path, "# Test").expect("temp doc");

        let saved = save_image_for_document(SaveImageForDocumentRequest {
            doc_path: doc_path.to_string_lossy().to_string(),
            original_name: "Screenshot 2026/04?.PNG".to_string(),
            media_type: Some("image/png".to_string()),
            bytes: vec![137, 80, 78, 71],
        })
        .expect("image import succeeds");

        assert_eq!(saved.markdown_path, format!("./images/{}", saved.file_name));
        assert!(saved.file_name.ends_with(".png"));
        assert!(!saved.file_name.contains('/'));
        assert!(!saved.file_name.contains('\\'));
        assert!(doc_directory.join("images").join(&saved.file_name).exists());

        let _ = fs::remove_dir_all(doc_directory);
    }

    #[test]
    fn image_helpers_generate_safe_names() {
        assert_eq!(sanitize_image_base_name("  Résumé Final!!.png "), "r-sum-final");
        assert_eq!(infer_image_extension("photo", Some("image/jpeg")), ".jpg");

        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("valid time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("libremd-image-name-test-{unique}"));
        fs::create_dir_all(&dir).expect("temp dir");
        fs::write(dir.join("image.png"), [1, 2, 3]).expect("seed existing image");

        let next = create_unique_image_filename(&dir, "image", ".png").expect("next filename");
        assert_eq!(next, "image-2.png");

        let _ = fs::remove_dir_all(dir);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![export_pdf, save_image_for_document, resolve_image])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let _app_handle = app.handle();

            // File menu - Export as direct items, no submenu
            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(app, "file.new", "New", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(app, "file.open", "Open...", true, Some("CmdOrCtrl+O"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "file.save", "Save", true, Some("CmdOrCtrl+S"))?,
                    &MenuItem::with_id(app, "file.saveAs", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "export.html", "Export as HTML...", true, Some("CmdOrCtrl+Shift+E"))?,
                    &MenuItem::with_id(app, "export.pdf", "Export as PDF...", true, Some("CmdOrCtrl+P"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "file.closeTab", "Close Tab", true, Some("CmdOrCtrl+W"))?,
                    &PredefinedMenuItem::quit(app, Some("Exit"))?,
                ],
            )?;

            // Edit menu
            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("Undo"))?,
                    &PredefinedMenuItem::redo(app, Some("Redo"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("Cut"))?,
                    &PredefinedMenuItem::copy(app, Some("Copy"))?,
                    &PredefinedMenuItem::paste(app, Some("Paste"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::select_all(app, Some("Select All"))?,
                ],
            )?;

            // View menu
            let view_menu = Submenu::with_items(
                app,
                "View",
                true,
                &[
                    &MenuItem::with_id(app, "view.split", "Split View", true, Some("CmdOrCtrl+Alt+1"))?,
                    &MenuItem::with_id(app, "view.source", "Source Only", true, Some("CmdOrCtrl+Alt+2"))?,
                    &MenuItem::with_id(app, "view.wysiwyg", "Preview Only", true, Some("CmdOrCtrl+Alt+3"))?,
                    &MenuItem::with_id(app, "view.zen", "Zen Mode", true, Some("CmdOrCtrl+Alt+4"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "view.toggle_sidebar", "Toggle Sidebar", true, Some("CmdOrCtrl+\\"))?,
                    &MenuItem::with_id(app, "view.toggle_fullscreen", "Toggle Fullscreen", true, Some("F11"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "view.cycle_theme", "Cycle Theme", true, Some("CmdOrCtrl+Shift+T"))?,
                ],
            )?;

            // Help menu
            let help_menu = Submenu::with_items(
                app,
                "Help",
                true,
                &[
                    &MenuItem::with_id(app, "help.about", "About LibreMD", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "help.shortcuts", "Keyboard Shortcuts", true, Some("CmdOrCtrl+Shift+P"))?,
                ],
            )?;

            let menu = Menu::with_items(
                app,
                &[&file_menu, &edit_menu, &view_menu, &help_menu],
            )?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.emit("menu-event", id);
                }
            });

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
