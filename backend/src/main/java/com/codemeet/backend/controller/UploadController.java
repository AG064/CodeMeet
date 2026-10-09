package com.codemeet.backend.controller;
import com.codemeet.backend.service.FileService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.Locale;

@RestController
public class UploadController {
    private final FileService files;
    public UploadController(FileService files) { this.files = files; }
    @GetMapping("/uploads/{filename:.+}")
    public ResponseEntity<Resource> download(@PathVariable String filename) {
        try {
            var path = files.resolveDownload(filename);
            String lower = filename.toLowerCase(Locale.ROOT);
            String mime = lower.endsWith(".png") ? "image/png" : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : lower.endsWith(".gif") ? "image/gif" : "application/octet-stream";
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(mime))
                    .header("Content-Disposition", (mime.startsWith("image/") ? "inline" : "attachment") + "; filename=\"" + filename + "\"")
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Content-Security-Policy", "default-src 'none'; sandbox")
                    .body(new FileSystemResource(path));
        } catch (IOException error) { return ResponseEntity.notFound().build(); }
    }
}
