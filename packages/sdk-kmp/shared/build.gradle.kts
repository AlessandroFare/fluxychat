plugins {
    kotlin("multiplatform")
    id("com.android.library")
    id("maven-publish")
    signing
}

group = "com.fluxychat"
version = findProperty("sdkVersion")?.toString() ?: "1.0.0-SNAPSHOT"

kotlin {
    androidTarget {
        publishLibraryVariants("release")
        compilations.all {
            compileTaskProvider.configure {
                compilerOptions {
                    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
                }
            }
        }
    }
    jvm()
    iosArm64 {
        binaries {
            framework {
                baseName = "FluxyChatSDK"
                isStatic = true
            }
        }
    }
    iosSimulatorArm64 {
        binaries {
            framework {
                baseName = "FluxyChatSDK"
                isStatic = true
            }
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.1")
                implementation("io.ktor:ktor-client-core:3.1.2")
                implementation("io.ktor:ktor-client-websockets:3.1.2")
            }
        }
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
        val jvmMain by getting {
            dependencies {
                implementation("io.ktor:ktor-client-cio:3.1.2")
            }
        }
        val androidMain by getting {
            dependencies {
                implementation("io.ktor:ktor-client-okhttp:3.1.2")
            }
        }
        val iosArm64Main by getting
        val iosSimulatorArm64Main by getting
        val iosMain by creating {
            dependsOn(commonMain)
            iosArm64Main.dependsOn(this)
            iosSimulatorArm64Main.dependsOn(this)
            dependencies {
                implementation("io.ktor:ktor-client-darwin:3.1.2")
            }
        }
    }
}

android {
    namespace = "chat.fluxy.sdk"
    compileSdk = 35
    defaultConfig {
        minSdk = 24
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

publishing {
    publications.withType<MavenPublication>().configureEach {
        pom {
            name.set("FluxyChat SDK")
            description.set("Kotlin Multiplatform WebSocket client for FluxyChat")
            url.set("https://github.com/AlessandroFare/fluxychat")
            licenses {
                license {
                    name.set("MIT")
                    url.set("https://opensource.org/licenses/MIT")
                }
            }
            scm {
                connection.set("scm:git:git://github.com/AlessandroFare/fluxychat.git")
                developerConnection.set("scm:git:ssh://github.com/AlessandroFare/fluxychat.git")
                url.set("https://github.com/AlessandroFare/fluxychat")
            }
        }
    }
    repositories {
        maven {
            name = "sonatype"
            url = uri("https://ossrh-staging-api.central.sonatype.com/service/local/staging/deploy/maven2/")
            credentials {
                username = System.getenv("OSSRH_USER")
                password = System.getenv("OSSRH_PASS")
            }
        }
    }
}

signing {
    val key = System.getenv("ORG_GRADLE_PROJECT_signingKey")
    if (!key.isNullOrBlank()) {
        useInMemoryPgpKeys(key, System.getenv("ORG_GRADLE_PROJECT_signingPassword"))
        sign(publishing.publications)
    }
}
