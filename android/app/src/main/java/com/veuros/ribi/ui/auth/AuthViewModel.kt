package com.veuros.ribi.ui.auth

import android.content.Context
import androidx.credentials.*
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase
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
    val adminMode: Boolean = false,
    val isAuthenticated: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val auth: FirebaseAuth,
    private val settingsRepo: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    // Web client ID — must match google-services.json
    private val WEB_CLIENT_ID = context.getString(com.veuros.ribi.R.string.default_web_client_id)

    init {
        checkAutoAdminLogin()
    }

    private fun checkAutoAdminLogin() {
        viewModelScope.launch {
            settingsRepo.isAdminDevice.collect { isAdmin ->
                if (isAdmin && auth.currentUser == null) {
                    // If admin device but no stored credentials, ignore
                }
            }
        }
    }

    fun signInWithGoogle(activityContext: Context) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
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
                val result = credManager.getCredential(
                    request = request,
                    context = activityContext
                )

                val credential = result.credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                    val firebaseCredential = GoogleAuthProvider.getCredential(
                        googleIdTokenCredential.idToken, null
                    )
                    auth.signInWithCredential(firebaseCredential).await()
                    _uiState.value = _uiState.value.copy(isLoading = false, isAuthenticated = true)
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Sign-in failed. Please try again."
                    )
                }
            } catch (e: GetCredentialException) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = null // User cancelled — silent
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Sign-in failed. Please try again."
                )
            }
        }
    }

    fun signInAsAdmin(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                auth.signInWithEmailAndPassword(email, password).await()
                settingsRepo.setAdminDevice(true)
                _uiState.value = _uiState.value.copy(isLoading = false, isAuthenticated = true)
            } catch (e: Exception) {
                val msg = when {
                    e.message?.contains("invalid-credential") == true -> "Invalid admin credentials."
                    e.message?.contains("user-not-found") == true     -> "Admin account not found."
                    e.message?.contains("wrong-password") == true     -> "Incorrect password."
                    e.message?.contains("too-many-requests") == true  -> "Too many attempts. Try later."
                    else -> "Admin login failed."
                }
                _uiState.value = _uiState.value.copy(isLoading = false, error = msg)
            }
        }
    }

    fun toggleAdminMode() {
        _uiState.value = _uiState.value.copy(adminMode = !_uiState.value.adminMode)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
