package com.veuros.ribi.ui.auth

import android.content.Context
import androidx.credentials.*
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.veuros.ribi.data.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val errorCode: AuthError = AuthError.NONE,
    val adminMode: Boolean = false,
    val isAuthenticated: Boolean = false,
    val isGuest: Boolean = false
)

enum class AuthError {
    NONE, NETWORK, CANCELLED, INVALID_CREDENTIALS, TOO_MANY_ATTEMPTS,
    NO_GOOGLE_ACCOUNT, UNKNOWN
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val auth: FirebaseAuth,
    private val settingsRepo: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val WEB_CLIENT_ID = context.getString(com.veuros.ribi.R.string.default_web_client_id)

    init {
        // If already signed in, proceed
        if (auth.currentUser != null) {
            _uiState.value = _uiState.value.copy(isAuthenticated = true)
        }
    }

    fun signInWithGoogle(activityContext: Context) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, errorCode = AuthError.NONE)
            try {
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(WEB_CLIENT_ID)
                    .setAutoSelectEnabled(false)
                    .build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()

                val credManager = CredentialManager.create(activityContext)
                val result = credManager.getCredential(request = request, context = activityContext)
                val credential = result.credential

                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                    val firebaseCredential = GoogleAuthProvider.getCredential(
                        googleIdTokenCredential.idToken, null
                    )
                    auth.signInWithCredential(firebaseCredential).await()
                    settingsRepo.setGuest(false)
                    _uiState.value = _uiState.value.copy(
                        isLoading = false, isAuthenticated = true, isGuest = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Sign-in failed. Please try again.",
                        errorCode = AuthError.UNKNOWN
                    )
                }
            } catch (e: GetCredentialCancellationException) {
                // User cancelled — don't show error
                _uiState.value = _uiState.value.copy(isLoading = false, error = null, errorCode = AuthError.NONE)
            } catch (e: NoCredentialException) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "No Google account found on this device. Please add one in Settings.",
                    errorCode = AuthError.NO_GOOGLE_ACCOUNT
                )
            } catch (e: GetCredentialException) {
                val (msg, code) = classifyGoogleError(e)
                _uiState.value = _uiState.value.copy(isLoading = false, error = msg, errorCode = code)
            } catch (e: Exception) {
                val (msg, code) = classifyGenericError(e)
                _uiState.value = _uiState.value.copy(isLoading = false, error = msg, errorCode = code)
            }
        }
    }

    fun signInAsAdmin(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, errorCode = AuthError.NONE)
            try {
                auth.signInWithEmailAndPassword(email, password).await()
                settingsRepo.setAdminDevice(true)
                settingsRepo.setGuest(false)
                _uiState.value = _uiState.value.copy(isLoading = false, isAuthenticated = true, isGuest = false)
            } catch (e: Exception) {
                val (msg, code) = classifyGenericError(e)
                _uiState.value = _uiState.value.copy(isLoading = false, error = msg, errorCode = code)
            }
        }
    }

    /** Skip auth and continue as local guest (no cloud sync) */
    fun continueAsGuest() {
        viewModelScope.launch {
            settingsRepo.setGuest(true)
            _uiState.value = _uiState.value.copy(
                isLoading = false, isAuthenticated = true, isGuest = true, error = null
            )
        }
    }

    fun toggleAdminMode() {
        _uiState.value = _uiState.value.copy(adminMode = !_uiState.value.adminMode, error = null)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null, errorCode = AuthError.NONE)
    }

    private fun classifyGoogleError(e: GetCredentialException): Pair<String, AuthError> {
        val msg = e.message ?: ""
        return when {
            msg.contains("network", ignoreCase = true) || msg.contains("NETWORK") ->
                "No internet connection. Check your connection and try again." to AuthError.NETWORK
            msg.contains("cancel", ignoreCase = true) ->
                null.toString() to AuthError.CANCELLED
            else ->
                "Google sign-in failed. Please try again." to AuthError.UNKNOWN
        }
    }

    private fun classifyGenericError(e: Exception): Pair<String, AuthError> {
        val msg = e.message ?: ""
        return when {
            msg.contains("NETWORK_ERROR") || msg.contains("network", ignoreCase = true) ->
                "No internet connection. Check your Wi-Fi or data." to AuthError.NETWORK
            msg.contains("invalid-credential") || msg.contains("INVALID_LOGIN_CREDENTIALS") ||
            msg.contains("WRONG_PASSWORD") || msg.contains("wrong-password") ->
                "Invalid email or password. Please check your credentials." to AuthError.INVALID_CREDENTIALS
            msg.contains("user-not-found") || msg.contains("USER_NOT_FOUND") ->
                "No account found with this email." to AuthError.INVALID_CREDENTIALS
            msg.contains("too-many-requests") || msg.contains("TOO_MANY_ATTEMPTS") ->
                "Too many failed attempts. Please wait a few minutes and try again." to AuthError.TOO_MANY_ATTEMPTS
            msg.contains("EMAIL_NOT_VERIFIED") ->
                "Please verify your email before signing in." to AuthError.UNKNOWN
            msg.contains("account-exists-with-different-credential") ->
                "An account already exists with a different sign-in method." to AuthError.UNKNOWN
            else ->
                "Sign-in failed. Please try again. (${e.javaClass.simpleName})" to AuthError.UNKNOWN
        }
    }
}
