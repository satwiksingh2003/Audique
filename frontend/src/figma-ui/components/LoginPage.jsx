// src/figma-ui/components/LoginPage.jsx
import { useState } from "react";
import { motion } from "motion/react";
import { Mail, Lock, Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { supabase } from "../../supabaseClient";

export function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMessage("Enter your email address first, then click Forgot password.");
      return;
    }
    setErrorMessage("");
    setInfoMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setInfoMessage("Password reset email sent — check your inbox.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage("");
    setInfoMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        // Create account + send verification email
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
        } else {
          setInfoMessage(
            "Check your email to verify your account. After verifying, come back and sign in."
          );
        }
      } else {
        // Sign in with email + password
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
        } else if (data?.session) {
          // Logged in successfully -> go to app
          onLoginSuccess();
        } else {
          setErrorMessage("Unable to sign in. Please verify your email first.");
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="
        min-h-screen relative z-10
        bg-gradient-to-br from-[#120042] via-[#23005f] to-[#4d0085]
        text-white
        flex items-center justify-center
        px-4
      "
    >
      {/* Background glow */}
      <motion.div
        className="pointer-events-none absolute -left-40 -top-40 w-80 h-80 rounded-full bg-pink-500/30 blur-3xl"
        animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -right-40 bottom-0 w-96 h-96 rounded-full bg-purple-500/30 blur-3xl"
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 7, repeat: Infinity }}
      />

      {/* Top-right theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Main card */}
      <div className="relative max-w-5xl w-full flex flex-col lg:flex-row items-center gap-12">
        {/* Left text / branding */}
        <motion.div
          className="flex-1 text-center lg:text-left"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
        >
          <motion.div
            className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              className="relative"
              whileHover={{ scale: 1.1, rotate: 180 }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-xl blur-lg opacity-70" />
              <div className="relative p-2 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </motion.div>
            <div className="text-sm text-gray-200">
              Classroom Recorder ·{" "}
              <span className="text-pink-200">
                AI-Powered Speech Recognition
              </span>
            </div>
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight">
            Audique
          </h1>
          <p className="text-gray-300 text-lg max-w-md">
            Sign in to capture lectures, generate summaries, flashcards, and
            searchable transcripts with AI.
          </p>
        </motion.div>

        {/* Right login/signup form card */}
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, type: "spring", delay: 0.1 }}
        >
          <div className="relative">
            <motion.div className="absolute inset-0 rounded-[32px] bg-purple-500/40 blur-3xl opacity-60" />
            <div className="relative rounded-[32px] bg-white/10 backdrop-blur-2xl border border-white/20 px-8 py-10 shadow-[0_0_80px_rgba(0,0,0,0.45)]">
              {/* Mode switch */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-1">
                    {mode === "signin" ? "Welcome Back" : "Create Account"}
                  </h2>
                  <p className="text-gray-300 text-sm">
                    {mode === "signin"
                      ? "Sign in to your account"
                      : "Sign up with your email to get started"}
                  </p>
                </div>

                <div className="flex gap-1 text-xs bg-white/10 rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className={`px-3 py-1 rounded-full ${
                      mode === "signin"
                        ? "bg-white text-purple-700"
                        : "text-gray-200"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className={`px-3 py-1 rounded-full ${
                      mode === "signup"
                        ? "bg-white text-purple-700"
                        : "text-gray-200"
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-200">Email</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-gray-400 outline-none focus:border-pink-400 focus:bg-white/15 transition-all"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-200">Password</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-gray-400 outline-none focus:border-pink-400 focus:bg-white/15 transition-all"
                      placeholder="Enter your password"
                    />
                  </div>
                  {mode === "signin" && (
                    <div className="text-right">
                      <button
                        type="button"
                        className="text-xs text-pink-200 hover:text-pink-100"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                {/* Error / info messages */}
                {errorMessage && (
                  <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {errorMessage}
                  </p>
                )}
                {infoMessage && (
                  <p className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                    {infoMessage}
                  </p>
                )}

                {/* Submit button */}
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  className="
                    w-full h-11 rounded-xl text-sm font-medium text-white
                    bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500
                    shadow-[0_0_40px_rgba(236,72,153,0.6)]
                    hover:shadow-[0_0_55px_rgba(236,72,153,0.9)]
                    transition-all disabled:opacity-60 disabled:cursor-not-allowed
                  "
                  whileHover={isSubmitting ? {} : { scale: 1.02 }}
                  whileTap={isSubmitting ? {} : { scale: 0.98 }}
                >
                  {isSubmitting
                    ? mode === "signup"
                      ? "Creating account..."
                      : "Signing in..."
                    : mode === "signup"
                    ? "Sign Up"
                    : "Sign In"}
                </motion.button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}