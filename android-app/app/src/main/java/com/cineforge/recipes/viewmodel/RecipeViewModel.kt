package com.cineforge.recipes.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cineforge.recipes.data.FixedAnchors
import com.cineforge.recipes.data.JobStatusResponse
import com.cineforge.recipes.data.StartRecipeRequest
import com.cineforge.recipes.network.CineForgeApiService
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class GenerationUiState {
    object Idle : GenerationUiState()
    data class Loading(val message: String) : GenerationUiState()
    data class Generating(val job: JobStatusResponse) : GenerationUiState()
    data class Success(val job: JobStatusResponse) : GenerationUiState()
    data class Error(val errorMessage: String) : GenerationUiState()
}

class RecipeViewModel(
    private val api: CineForgeApiService = CineForgeApiService.create()
) : ViewModel() {

    private val _uiState = MutableStateFlow<GenerationUiState>(GenerationUiState.Idle)
    val uiState: StateFlow<GenerationUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null

    fun startRecipeGeneration(dishName: String, apiKey: String? = null) {
        if (dishName.isBlank()) {
            _uiState.value = GenerationUiState.Error("Por favor, digite o nome do prato.")
            return
        }

        viewModelScope.launch {
            _uiState.value = GenerationUiState.Loading("Enviando receita para a IA...")
            try {
                val request = StartRecipeRequest(
                    dishName = dishName.trim(),
                    category = "Gastronomia",
                    aspectRatio = "9:16",
                    fixedAnchors = FixedAnchors()
                )

                val response = api.startRecipePipeline(request, customApiKey = apiKey?.takeIf { it.isNotBlank() })
                if (response.ok) {
                    startPolling(response.jobId)
                } else {
                    _uiState.value = GenerationUiState.Error("Falha ao iniciar processo no servidor.")
                }
            } catch (e: Exception) {
                _uiState.value = GenerationUiState.Error("Erro de conexão: ${e.localizedMessage ?: "Tente novamente."}")
            }
        }
    }

    private fun startPolling(jobId: String) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            var isRunning = true
            while (isRunning) {
                try {
                    val status = api.getJobStatus(jobId)
                    when (status.status) {
                        "completed" -> {
                            _uiState.value = GenerationUiState.Success(status)
                            isRunning = false
                        }
                        "failed" -> {
                            _uiState.value = GenerationUiState.Error(status.error ?: "Falha na geração do vídeo.")
                            isRunning = false
                        }
                        else -> {
                            _uiState.value = GenerationUiState.Generating(status)
                            delay(4000) // Consulta o status a cada 4 segundos
                        }
                    }
                } catch (e: Exception) {
                    // Mantém tentativa se for instabilidade de rede transitória
                    delay(5000)
                }
            }
        }
    }

    fun reset() {
        pollingJob?.cancel()
        _uiState.value = GenerationUiState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
