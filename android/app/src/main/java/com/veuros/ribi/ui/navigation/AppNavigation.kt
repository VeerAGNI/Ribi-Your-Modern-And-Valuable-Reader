package com.veuros.ribi.ui.navigation

import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.*
import com.google.firebase.auth.FirebaseAuth
import com.veuros.ribi.ui.auth.AuthScreen
import com.veuros.ribi.ui.home.HomeScreen
import com.veuros.ribi.ui.reader.ReaderScreen
import com.veuros.ribi.ui.splash.SplashScreen

sealed class Screen(val route: String) {
    object Splash  : Screen("splash")
    object Auth    : Screen("auth")
    object Home    : Screen("home")
    object Reader  : Screen("reader/{bookId}") {
        fun createRoute(bookId: String) = "reader/$bookId"
    }
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Screen.Splash.route
    ) {
        composable(Screen.Splash.route) {
            SplashScreen(
                onComplete = {
                    val user = FirebaseAuth.getInstance().currentUser
                    val dest = if (user != null) Screen.Home.route else Screen.Auth.route
                    navController.navigate(dest) {
                        popUpTo(Screen.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Auth.route) {
            AuthScreen(
                onAuthSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Home.route) {
            HomeScreen(
                onOpenBook = { bookId ->
                    navController.navigate(Screen.Reader.createRoute(bookId))
                },
                onSignOut = {
                    FirebaseAuth.getInstance().signOut()
                    navController.navigate(Screen.Auth.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Reader.route) { backStackEntry ->
            val bookId = backStackEntry.arguments?.getString("bookId") ?: return@composable
            ReaderScreen(
                bookId = bookId,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
