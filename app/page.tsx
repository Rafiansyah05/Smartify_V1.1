import { LoginForm } from "@/components/auth/login-form";
import { Footer } from "@/components/layout/footer";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <LoginForm />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
