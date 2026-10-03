import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Release signing (android-release schema 6.2). The keystore and its passwords
// live OUTSIDE the repository on the release machine, like the Apple keys: the
// properties file (storeFile, storePassword, keyAlias, keyPassword) is named by
// SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES, or is the gitignored keystore.properties
// beside this project. With no such file the release build is UNSIGNED, which
// is what CI produces and what a build-from-source store signs itself. Nothing
// here ever creates a keystore, and no password is ever written in this file.
val keystoreProperties = Properties().apply {
    val named = System.getenv("SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES")
    val propFile = if (!named.isNullOrBlank()) file(named) else rootProject.file("keystore.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    signingConfigs {
        if (keystoreProperties.getProperty("storeFile") != null) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }
    compileSdk = 36
    namespace = "com.dtgibson.snowraven"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.dtgibson.snowraven"
        // minSdk 26 (Android 8.0), decided by the user 2026-10-03: the locked
        // Tauri 2.11.2 Android runtime pins jackson-databind 2.15.3, whose
        // ExceptionUtil references java.lang.BootstrapMethodError (API 26+), so the
        // app crashes at launch on API 24 and 25 (pipeline/android-release/decisions.md).
        minSdk = 26
        // targetSdk 36 (Android 16), read 2026-10-03: the tauri-cli 2.11.2 template
        // value, and Google Play's requirement for new apps and updates from
        // 2026-08-31. Re-read the current requirement before a store submission.
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            signingConfigs.findByName("release")?.let { signingConfig = it }
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")