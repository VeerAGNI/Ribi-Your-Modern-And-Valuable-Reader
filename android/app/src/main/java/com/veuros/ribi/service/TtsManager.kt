package com.veuros.ribi.service

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.veuros.ribi.data.model.TtsVoice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TtsManager @Inject constructor() {

    companion object {
        private const val TAG = "TtsManager"
        private const val UTTERANCE_ID = "ribi_page_read"
    }

    private var tts: TextToSpeech? = null
    @Volatile private var isReady = false

    fun initialize(context: Context, onReady: () -> Unit = {}) {
        if (tts != null) { if (isReady) onReady(); return }
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                isReady = true
                onReady()
                Log.d(TAG, "TTS initialized")
            } else {
                Log.e(TAG, "TTS init failed with status $status")
            }
        }
    }

    fun speak(
        text: String,
        voice: TtsVoice,
        speed: Float,
        onDone: () -> Unit = {},
        onError: () -> Unit = {}
    ) {
        if (!isReady || text.isBlank()) return
        tts?.apply {
            stop()
            when (voice) {
                TtsVoice.FEMALE -> { setPitch(1.10f); setSpeechRate(speed) }
                TtsVoice.MALE   -> { setPitch(0.82f); setSpeechRate(speed) }
            }
            setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) { onDone() }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) { onError() }
            })
            speak(text, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE_ID)
        }
    }

    fun stop() {
        tts?.stop()
    }

    fun isSpeaking(): Boolean = tts?.isSpeaking == true

    fun release() {
        tts?.shutdown()
        tts = null
        isReady = false
    }

    /** Extract text from a specific page of a PDF file using PDFBox */
    suspend fun extractPageText(file: File, pageIndex: Int): String = withContext(Dispatchers.IO) {
        try {
            PDDocument.load(file).use { doc ->
                if (pageIndex >= doc.numberOfPages) return@withContext ""
                val stripper = PDFTextStripper().apply {
                    startPage = pageIndex + 1
                    endPage = pageIndex + 1
                    sortByPosition = true
                }
                val text = stripper.getText(doc).trim()
                // Clean up extracted text: collapse multiple blank lines, trim whitespace
                text.lines()
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                    .joinToString(" ")
                    .take(4000) // Limit TTS chunk size
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to extract text from page ${pageIndex + 1}", e)
            ""
        }
    }
}
