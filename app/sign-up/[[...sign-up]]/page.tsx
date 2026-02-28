import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-grid flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-[#7c6af7]/10 via-transparent to-[#a78bfa]/5" />
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold gradient-text mb-2">Insta Builder</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            @denniskral_ · Content Creation Studio
          </p>
        </div>
        <SignUp
          appearance={{
            variables: {
              colorBackground: "#111118",
              colorInputBackground: "#1a1a24",
              colorText: "#f0f0f5",
              colorTextSecondary: "rgba(240,240,245,0.5)",
              colorPrimary: "#7c6af7",
              colorInputText: "#f0f0f5",
              borderRadius: "12px",
            },
          }}
        />
      </div>
    </div>
  );
}
