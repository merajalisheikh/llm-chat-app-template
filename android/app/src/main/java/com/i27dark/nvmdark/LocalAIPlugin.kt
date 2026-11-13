
package com.i27dark.nvmdark

import com.arm.aichat.AiChat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect
import java.io.File

@CapacitorPlugin(name = "LocalAI")
class LocalAIPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var engine: com.arm.aichat.InferenceEngine? = null

    @PluginMethod
    fun loadModel(call: PluginCall) {
        scope.launch {
            try {
                val modelFile = File(context.filesDir, "tinyllama.gguf")

                if (!modelFile.exists() || modelFile.length() < 500_000_000L) {
                    context.assets.open("models/tinyllama.gguf").use { input ->
                        modelFile.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    }
                }

                val ai = engine ?: AiChat.getInferenceEngine(context).also {
                    engine = it
                }

                ai.loadModel(modelFile.absolutePath)
                ai.setSystemPrompt("You are a helpful AI assistant. Answer the user clearly and briefly.")
                call.resolve(JSObject().put("success", true))
            } catch (e: Exception) {
                call.reject(e.message ?: "Model loading failed")
            }
        }
    }

    @PluginMethod
    fun setSystemPrompt(call: PluginCall) {
        scope.launch {
            try {
                val ai = engine ?: throw Exception("Load model first")
                ai.setSystemPrompt(call.getString("prompt") ?: "")
                call.resolve()
            } catch (e: Exception) {
                call.reject(e.message ?: "System prompt failed")
            }
        }
    }

    @PluginMethod
    fun sendPrompt(call: PluginCall) {
        val message = call.getString("message")
        if (message.isNullOrBlank()) {
            call.reject("Message is missing")
            return
        }

        scope.launch {
            try {
                val ai = engine ?: throw Exception("Load model first")
                ai.sendUserPrompt(message).collect { token ->
                    notifyListeners("token", JSObject().put("token", token))
                }
                notifyListeners("complete", JSObject())
                call.resolve()
            } catch (e: Exception) {
                call.reject(e.message ?: "Generation failed")
            }
        }
    }

    @PluginMethod
    fun unloadModel(call: PluginCall) {
        engine?.cleanUp()
        call.resolve()
    }
}
