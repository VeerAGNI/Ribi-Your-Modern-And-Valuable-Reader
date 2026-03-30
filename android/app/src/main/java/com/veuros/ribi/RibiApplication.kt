package com.veuros.ribi

import android.app.Application
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class RibiApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize PDFBox for PDF text extraction (used by TTS)
        PDFBoxResourceLoader.init(applicationContext)
    }
}
