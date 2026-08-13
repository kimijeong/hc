package com.ooo.flowcheck

import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.addCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)


        webView = findViewById(R.id.webView)

        // assets 폴더의 HTML을 HTTPS 주소처럼 불러오기
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler(
                "/assets/",
                WebViewAssetLoader.AssetsPathHandler(this)
            )
            .build()

        webView.webViewClient = object : WebViewClientCompat() {

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {

                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        // HTML에서 JavaScript와 localStorage를 사용하므로 필요
        with(webView.settings) {

            javaScriptEnabled = true
            domStorageEnabled = true

            // 보안을 위해 file:// 접근은 사용하지 않음
            allowFileAccess = false
            allowContentAccess = false
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d(
                    "FlowCheckWeb",
                    "${consoleMessage.message()} " +
                            "(${consoleMessage.sourceId()}:${consoleMessage.lineNumber()})"
                )
                return true
            }
        }

        // index.html 실행
        webView.loadUrl(
            "https://appassets.androidplatform.net/assets/index.html"
        )

        // 안드로이드 뒤로가기
        onBackPressedDispatcher.addCallback(this) {

            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                finish()
            }
        }
    }
}