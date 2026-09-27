package com.cineforge.recipes.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.cineforge.recipes.viewmodel.GenerationUiState
import com.cineforge.recipes.viewmodel.RecipeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecipeHomeScreen(viewModel: RecipeViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    var dishInput by remember { mutableStateOf("Macarrão com Alho e Camarão Suculento") }
    var customApiKey by remember { mutableStateOf("") }
    var showApiKeyField by remember { mutableStateOf(false) }

    when (val state = uiState) {
        is GenerationUiState.Success -> {
            val videoUrl = state.job.stitchedVideoUrl ?: ""
            VideoPlayerScreen(
                videoUrl = videoUrl,
                dishTitle = state.job.dishName,
                onBack = { viewModel.reset() }
            )
        }
        else -> {
            Scaffold(
                topBar = {
                    TopAppBar(
                        title = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    "⚡ CineForge Receitas",
                                    color = Color(0xFFF59E0B),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp
                                )
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = Color(0xFF0F172A)
                        )
                    )
                },
                containerColor = Color(0xFF090D16)
            ) { padding ->
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Card Principal de Entrada
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Qual prato ou receita você quer gravar?",
                                    color = Color.White,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "A IA dividirá o preparo em 5 tomadas lógicas (Tábua ➔ Frigideira ➔ Proteína ➔ Empratamento ➔ Garfada)",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 13.sp
                                )
                                Spacer(modifier = Modifier.height(14.dp))

                                OutlinedTextField(
                                    value = dishInput,
                                    onValueChange = { dishInput = it },
                                    label = { Text("Nome do prato ou ideia culinária") },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White,
                                        focusedBorderColor = Color(0xFFF59E0B),
                                        unfocusedBorderColor = Color(0xFF334155)
                                    )
                                )

                                Spacer(modifier = Modifier.height(12.dp))

                                TextButton(onClick = { showApiKeyField = !showApiKeyField }) {
                                    Text(
                                        if (showApiKeyField) "▲ Ocultar Chave Agnes AI" else "▼ Chave Agnes AI própria (Opcional)",
                                        color = Color(0xFFF59E0B),
                                        fontSize = 12.sp
                                    )
                                }

                                if (showApiKeyField) {
                                    OutlinedTextField(
                                        value = customApiKey,
                                        onValueChange = { customApiKey = it },
                                        label = { Text("Agnes API Key") },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = Color(0xFFF59E0B),
                                            unfocusedBorderColor = Color(0xFF334155)
                                        )
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                Button(
                                    onClick = {
                                        viewModel.startRecipeGeneration(dishInput, customApiKey)
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(50.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                                    shape = RoundedCornerShape(12.dp),
                                    enabled = uiState !is GenerationUiState.Loading && uiState !is GenerationUiState.Generating
                                ) {
                                    Text(
                                        "⚡ GERAR VÍDEO COMPLETO (1-CLIQUE)",
                                        color = Color.Black,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                    }

                    // Card de Status / Progresso em Tempo Real
                    when (val current = uiState) {
                        is GenerationUiState.Loading -> {
                            item {
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(24.dp),
                                        horizontalAlignment = Alignment.CenterVertically
                                    ) {
                                        CircularProgressIndicator(color = Color(0xFFF59E0B))
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Text(current.message, color = Color.White)
                                    }
                                }
                            }
                        }
                        is GenerationUiState.Generating -> {
                            val job = current.job
                            item {
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                "Pipeline em Execução",
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Text(
                                                "${job.progress}%",
                                                color = Color(0xFFF59E0B),
                                                fontWeight = FontWeight.Bold
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(8.dp))
                                        LinearProgressIndicator(
                                            progress = { job.progress / 100f },
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(8.dp)
                                                .clip(RoundedCornerShape(4.dp)),
                                            color = Color(0xFFF59E0B),
                                            trackColor = Color(0xFF334155)
                                        )

                                        Spacer(modifier = Modifier.height(12.dp))
                                        Text(
                                            text = job.message,
                                            color = Color(0xFF94A3B8),
                                            fontSize = 13.sp
                                        )
                                    }
                                }
                            }

                            // Lista das etapas sendo geradas
                            job.steps?.let { steps ->
                                items(steps) { step ->
                                    Card(
                                        colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            if (step.imageUrl != null) {
                                                AsyncImage(
                                                    model = step.imageUrl,
                                                    contentDescription = null,
                                                    modifier = Modifier
                                                        .size(54.dp)
                                                        .clip(RoundedCornerShape(8.dp)),
                                                    contentScale = ContentScale.Crop
                                                )
                                                Spacer(modifier = Modifier.width(12.dp))
                                            }
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    "Passo ${step.stepNumber}: ${step.actionTitle}",
                                                    color = Color.White,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontSize = 14.sp
                                                )
                                                step.voiceoverText?.let {
                                                    Text(
                                                        it,
                                                        color = Color(0xFF94A3B8),
                                                        fontSize = 12.sp,
                                                        maxLines = 1
                                                    )
                                                }
                                            }
                                            Surface(
                                                color = if (step.status == "completed") Color(0xFF10B981) else Color(0xFF334155),
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = if (step.status == "completed") "PRONTO" else "IA...",
                                                    color = Color.White,
                                                    fontSize = 10.sp,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        is GenerationUiState.Error -> {
                            item {
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF451A1A)),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text("Erro na geração", color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(current.errorMessage, color = Color.White, fontSize = 13.sp)
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Button(
                                            onClick = { viewModel.reset() },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                                        ) {
                                            Text("Tentar Novamente", color = Color.White)
                                        }
                                    }
                                }
                            }
                        }
                        else -> {}
                    }
                }
            }
        }
    }
}
