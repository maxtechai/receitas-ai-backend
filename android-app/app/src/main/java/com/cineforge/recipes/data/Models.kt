package com.cineforge.recipes.data

import com.google.gson.annotations.SerializedName

data class StartRecipeRequest(
    @SerializedName("dishName") val dishName: String,
    @SerializedName("category") val category: String = "Gastronomia",
    @SerializedName("aspectRatio") val aspectRatio: String = "9:16",
    @SerializedName("fixedAnchors") val fixedAnchors: FixedAnchors? = null
)

data class FixedAnchors(
    @SerializedName("hands") val hands: String = "Mãos femininas cuidadas, unhas vermelhas e anel discreto",
    @SerializedName("countertop") val countertop: String = "Bancada rústica de carvalho escuro",
    @SerializedName("lighting") val lighting: String = "Luz difusa de janela matinal 5600K suave"
)

data class StartRecipeResponse(
    @SerializedName("ok") val ok: Boolean,
    @SerializedName("jobId") val jobId: String,
    @SerializedName("status") val status: String,
    @SerializedName("message") val message: String
)

data class RecipeJobStep(
    @SerializedName("stepNumber") val stepNumber: Int,
    @SerializedName("actionTitle") val actionTitle: String,
    @SerializedName("station") val station: String,
    @SerializedName("voiceoverText") val voiceoverText: String?,
    @SerializedName("imageUrl") val imageUrl: String?,
    @SerializedName("videoUrl") val videoUrl: String?,
    @SerializedName("status") val status: String
)

data class JobStatusResponse(
    @SerializedName("jobId") val jobId: String,
    @SerializedName("status") val status: String, // queued, scripting, processing, completed, failed
    @SerializedName("progress") val progress: Int, // 0 to 100
    @SerializedName("message") val message: String,
    @SerializedName("dishName") val dishName: String,
    @SerializedName("currentStepIndex") val currentStepIndex: Int,
    @SerializedName("totalSteps") val totalSteps: Int,
    @SerializedName("stitchedVideoUrl") val stitchedVideoUrl: String?,
    @SerializedName("steps") val steps: List<RecipeJobStep>?,
    @SerializedName("error") val error: String?
)
