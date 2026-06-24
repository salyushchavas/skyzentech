package com.skyzen.careers.mail;

import com.skyzen.careers.integration.s3.S3StorageService;
import com.skyzen.careers.mail.service.S3MailBlobStore;
import com.skyzen.careers.security.AesGcmCipher;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Proves the ciphertext-at-rest guarantee WITHOUT a live S3: the bytes handed to
 * S3StorageService.putObject are NOT the plaintext, and fetch() round-trips back
 * to the original. Uses a real AesGcmCipher (test key) + a mocked S3.
 */
class S3MailBlobStoreTest {

    private S3StorageService mockReadyS3() {
        S3StorageService s3 = mock(S3StorageService.class);
        when(s3.isReady()).thenReturn(true);
        when(s3.key(anyString(), anyString(), anyString())).thenReturn("mail/attachments/obj.bin");
        return s3;
    }

    private AesGcmCipher testCipher() {
        byte[] key = new byte[32];
        for (int i = 0; i < key.length; i++) key[i] = (byte) i;
        return new AesGcmCipher(Base64.getEncoder().encodeToString(key));
    }

    @Test
    void store_writesCiphertext_notPlaintext_andFetchRoundTrips() {
        S3StorageService s3 = mockReadyS3();
        AesGcmCipher cipher = testCipher();
        S3MailBlobStore store = new S3MailBlobStore(s3, cipher);

        byte[] plain = "Top secret attachment contents  binary".getBytes(StandardCharsets.UTF_8);

        ArgumentCaptor<byte[]> putCap = ArgumentCaptor.forClass(byte[].class);
        String storageKey = store.store(plain);

        org.mockito.Mockito.verify(s3).putObject(eq("mail/attachments/obj.bin"), putCap.capture(), anyString());
        byte[] stored = putCap.getValue();
        // The bytes in S3 must NOT equal the plaintext (encrypted at rest).
        assertFalse(java.util.Arrays.equals(plain, stored), "stored bytes must be ciphertext, not plaintext");
        // Ciphertext must not contain the plaintext as a subsequence either.
        assertFalse(new String(stored, StandardCharsets.UTF_8).contains("Top secret"),
                "plaintext must not appear in the stored object");
        assertTrue(storageKey.startsWith("s3:"));

        // fetch() decrypts the same bytes back to the original.
        when(s3.getObject("mail/attachments/obj.bin")).thenReturn(stored);
        assertArrayEquals(plain, store.fetch(storageKey));
    }
}
