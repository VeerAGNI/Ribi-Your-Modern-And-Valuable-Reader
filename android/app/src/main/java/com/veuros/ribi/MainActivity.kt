package com.veuros.ribi

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.veuros.ribi.ui.navigation.AppNavigation
import com.veuros.ribi.ui.theme.RibiTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            RibiTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF00040F)
                ) {
                    AppNavigation()
                }
            }
        }
    }
}
