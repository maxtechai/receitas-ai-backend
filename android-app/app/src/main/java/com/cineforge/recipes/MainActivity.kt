package com.cineforge.recipes

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.cineforge.recipes.ui.RecipeHomeScreen
import com.cineforge.recipes.viewmodel.RecipeViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: RecipeViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RecipeHomeScreen(viewModel = viewModel)
        }
    }
}
