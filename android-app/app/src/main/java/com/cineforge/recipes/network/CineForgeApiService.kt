package com.cineforge.recipes.network

import com.cineforge.recipes.data.JobStatusResponse
import com.cineforge.recipes.data.StartRecipeRequest
import com.cineforge.recipes.data.StartRecipeResponse
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import java.util.concurrent.TimeUnit

interface CineForgeApiService {

    @POST("api/recipes/pipeline/start")
    suspend fun startRecipePipeline(
        @Body request: StartRecipeRequest,
        @Header("x-agnes-key") customApiKey: String? = null
    ): StartRecipeResponse

    @GET("api/recipes/pipeline/status/{jobId}")
    suspend fun getJobStatus(
        @Path("jobId") jobId: String
    ): JobStatusResponse

    companion object {
        // Endereço de produção no seu domínio VPS (nossamor.shop/receitasia/)
        // IMPORTANTE no Retrofit: URLs base que possuem subpastas DEVEM terminar com "/"
        const val BASE_URL = "https://nossamor.shop/receitasia/"

        // URL de desenvolvimento reserva (caso queira alternar durante testes)
        const val DEV_URL = "https://ais-dev-eqfrylnsl2oqpm6gysv3fh-469375095307.us-west2.run.app/"

        fun create(baseUrl: String = BASE_URL): CineForgeApiService {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val client = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .addInterceptor(logging)
                .build()

            return Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(CineForgeApiService::class.java)
        }
    }
}
