package com.codemeet.backend.service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.io.*;
import java.nio.file.*;
import java.awt.image.BufferedImage;
import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.util.UUID;

@Service
public class FileService {
    @Value("${file.upload-dir}") private String uploadDir;
    private BufferedImage decodeRaster(byte[] bytes) throws IOException {
        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) return null;
            var reader = readers.next();
            try {
                if (!java.util.Set.of("jpeg", "jpg", "png", "gif").contains(reader.getFormatName().toLowerCase(java.util.Locale.ROOT))) return null;
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > 16_000_000) throw new IOException("Image exceeds 16 megapixels");
                return reader.read(0);
            } finally { reader.dispose(); }
        }
    }
    public String saveProfileImage(MultipartFile file) throws IOException {
        BufferedImage image;
        try { image = decodeRaster(readUpload(file)); }
        catch (IOException | RuntimeException error) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile image must be valid PNG, JPEG or GIF of at most 16 megapixels"); }
        if (image == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile image must be PNG, JPEG or GIF");
        var pixels = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_ARGB);
        var graphics = pixels.createGraphics();
        try { graphics.drawImage(image, 0, 0, null); } finally { graphics.dispose(); }
        var encoded = new ByteArrayOutputStream();
        if (!ImageIO.write(pixels, "png", encoded)) throw new IOException("PNG encoder unavailable");
        return store(encoded.toByteArray(), ".png");
    }
    public String saveFile(MultipartFile file) throws IOException {
        byte[] bytes = readUpload(file);
        String original = file.getOriginalFilename();
        String extension = ".bin";
        if (original != null && original.lastIndexOf('.') >= 0) {
            String suffix = original.substring(original.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT);
            if (suffix.matches("[a-z0-9]{1,16}") && !java.util.Set.of("png", "jpg", "jpeg", "gif").contains(suffix)) extension = "." + suffix;
        }
        try {
            if (decodeRaster(bytes) != null) {
                try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
                    var reader = ImageIO.getImageReaders(input).next();
                    try {
                        extension = switch (reader.getFormatName().toLowerCase(java.util.Locale.ROOT)) {
                            case "jpeg", "jpg" -> ".jpg"; case "png" -> ".png"; case "gif" -> ".gif"; default -> ".bin";
                        };
                    } finally { reader.dispose(); }
                }
            }
        } catch (IOException | RuntimeException error) {
            // Preserve generic attachment bytes as inert downloads.
        }
        return store(bytes, extension);
    }
    private byte[] readUpload(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File must not be empty");
        if (file.getSize() > 5 * 1024 * 1024) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File exceeds 5 MiB");
        return file.getBytes();
    }
    private String store(byte[] bytes, String extension) throws IOException {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(root);
        String name = UUID.randomUUID() + extension;
        Files.write(root.resolve(name), bytes, StandardOpenOption.CREATE_NEW);
        return "/uploads/" + name;
    }
    public Path resolveDownload(String name) throws IOException {
        if (name == null || !name.matches("[0-9a-fA-F-]{36}\\.[A-Za-z0-9]{1,16}")) throw new NoSuchFileException("Invalid upload name");
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize().toRealPath();
        Path target = root.resolve(name).toRealPath();
        if (!target.startsWith(root) || !Files.isRegularFile(target)) throw new NoSuchFileException(name);
        return target;
    }
    public void deleteFileByUrl(String fileUrl) throws IOException {
        if (fileUrl == null || fileUrl.isBlank()) return;
        String name = Paths.get(fileUrl.replace('\\', '/').trim()).getFileName().toString();
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize(), target = root.resolve(name).normalize();
        if (!target.startsWith(root)) throw new IOException("Refusing to delete outside upload directory");
        Files.deleteIfExists(target);
    }
}
