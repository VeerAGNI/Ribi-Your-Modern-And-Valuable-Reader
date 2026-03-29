package com.veuros.ribi.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Binder
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.veuros.ribi.R
import com.veuros.ribi.data.model.BackgroundTracks

class MusicService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var currentTrackId: String? = null
    private var currentVolume: Float = 0.5f
    private val binder = MusicBinder()

    inner class MusicBinder : Binder() {
        fun getService(): MusicService = this@MusicService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    fun playTrack(trackId: String?, volume: Float = 0.5f) {
        currentVolume = volume
        if (trackId == null) {
            stopPlayback()
            return
        }
        if (trackId == currentTrackId && mediaPlayer?.isPlaying == true) {
            setVolume(volume)
            return
        }

        val track = BackgroundTracks.tracks.find { it.id == trackId } ?: return
        stopPlayback()
        currentTrackId = trackId

        try {
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                setDataSource(track.url)
                isLooping = true
                setVolume(volume, volume)
                prepareAsync()
                setOnPreparedListener { start() }
                setOnErrorListener { _, _, _ ->
                    stopPlayback()
                    true
                }
            }
            startForeground(NOTIFICATION_ID, buildNotification(track.name))
        } catch (e: Exception) {
            currentTrackId = null
        }
    }

    fun stopPlayback() {
        mediaPlayer?.apply {
            if (isPlaying) stop()
            release()
        }
        mediaPlayer = null
        currentTrackId = null
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    fun setVolume(volume: Float) {
        currentVolume = volume
        mediaPlayer?.setVolume(volume, volume)
    }

    fun getCurrentTrack() = currentTrackId
    fun isPlaying() = mediaPlayer?.isPlaying == true

    override fun onDestroy() {
        stopPlayback()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Background Music",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Ribi ambient reading music" }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun buildNotification(trackName: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Ribi")
            .setContentText("Playing: $trackName")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "ribi_music"
        const val NOTIFICATION_ID = 1001
    }
}
