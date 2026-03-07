package com.codemeet.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileService {

    @Value("${file.upload-dir}")
    private String uploadDir;

    public String saveFile(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Failed to store empty file.");
        }

        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename());
        String fileExtension = "";
        
        try {
            fileExtension = originalFileName.substring(originalFileName.lastIndexOf("."));
        } catch (Exception e) {
            fileExtension = ".jpg";
        }
        
        String newFileName = UUID.randomUUID().toString() + fileExtension;
        Path filePath = uploadPath.resolve(newFileName);

        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        return "/uploads/" + newFileName;
    }

    public void deleteFileByUrl(String fileUrl) throws IOException {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }

        String normalized = fileUrl.replace('\\', '/').trim();
        String fileName = Paths.get(normalized).getFileName().toString();
        if (!StringUtils.hasText(fileName)) {
            return;
        }

        Path uploadPath = Paths.get(uploadDir);
        Path targetPath = uploadPath.resolve(fileName).normalize();
        if (!targetPath.startsWith(uploadPath.normalize())) {
            throw new IOException("Refusing to delete file outside upload directory");
        }

        Files.deleteIfExists(targetPath);
    }
}
