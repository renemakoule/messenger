"use client";

import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { FaGoogle } from "react-icons/fa"; // Une icône pour le bouton

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setIsFormVisible(true);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Vous pouvez spécifier une URL de redirection après la connexion si nécessaire
        // redirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // La redirection vers Google est gérée par Supabase, donc pas besoin de `router.push` ici.
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-white/90 via-black/600 to-black/200 ">
      {/* Left Side: Demonstrative Image */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center ml-9 transition-all duration-1000 ease-in-out transform">
        <div
          className={`relative h-[400px] w-[400px] hidden md:block transition-all duration-1000 ease-in-out transform ${
            isFormVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          <Image
            src="/documents.png"
            fill
            className="object-contain dark:hidden"
            alt="Documents"
          />
        </div>
        <div
          className={`relative h-[400px] w-[400px] hidden md:block transition-all duration-1000 ease-in-out transform ${
            isFormVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          <Image
            src="/reading.png"
            fill
            className="object-contain dark:hidden"
            alt="Reading"
          />
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div
          className={`w-full max-w-md bg-white px-8 py-10 shadow-lg rounded-lg transition-all duration-1000 ease-in-out transform ${
            isFormVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Welcome to Chat Messenger
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to continue
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 animate-fade-in">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Authentication Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex w-full cursor-pointer justify-center items-center rounded-md border border-gray-300 bg-white py-3 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-in-out"
              aria-label="Sign in with Google"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-3 text-gray-700"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Redirecting...
                </>
              ) : (
                <>
                  <FaGoogle className="mr-3 h-5 w-5" />
                  Sign in with Google
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}