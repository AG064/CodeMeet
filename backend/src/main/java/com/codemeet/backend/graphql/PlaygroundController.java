package com.codemeet.backend.graphql;

import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.nio.file.Files;

@Controller
@Profile("dev")
public class PlaygroundController {

    @GetMapping(path = "/playground", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> playground() throws Exception {
        ClassPathResource res = new ClassPathResource("graphql/playground.html");
        String html = Files.readString(res.getFile().toPath());
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }
}
