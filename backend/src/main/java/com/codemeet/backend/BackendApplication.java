package com.codemeet.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(BackendApplication.class);
        // Support a short developer flag -d or --dev to activate the 'dev' profile which enables the playground
        for (String arg : args) {
            if ("-d".equals(arg) || "--dev".equals(arg)) {
                app.setAdditionalProfiles("dev");
                break;
            }
        }
        app.run(args);
    }

}
