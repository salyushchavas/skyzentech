package com.skyzen.careers;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * {@link EnableScheduling} powers the @Scheduled methods (currently only the
 * batch-1 interview-reminder cron in
 * {@link com.skyzen.careers.notification.InterviewReminderScheduler}).
 */
@SpringBootApplication
@EnableScheduling
public class SkyzenCareersApplication {
    public static void main(String[] args) {
        SpringApplication.run(SkyzenCareersApplication.class, args);
    }
}
