import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  Activity,
  Mail,
  Lock,
  User,
  ArrowLeft,
  Sparkles,
  Shield,
  Smartphone,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const emailSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

type AuthMode = "signIn" | "signUp" | "forgotPassword" | "otpVerify";
type AuthMethod = "password" | "otp";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = signUpSchema.parse({ fullName, email, password });
      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: validated.fullName,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error(
            "This email is already registered. Please sign in instead."
          );
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Please check your email to confirm your account!", {
        description: "We sent a verification link to " + validated.email,
        duration: 8000,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = signInSchema.parse({ email, password });
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid")) {
          toast.error("Invalid email or password");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error(
            "Please verify your email first. Check your inbox for the confirmation link."
          );
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Welcome back!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = emailSchema.parse({ email });
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: validated.email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setOtpSent(true);
      setMode("otpVerify");
      toast.success("OTP sent to your email!", {
        description: "Check your inbox for the verification code",
        duration: 6000,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Welcome!");
    } catch (error) {
      toast.error("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = emailSchema.parse({ email });
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(
        validated.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password reset link sent!", {
        description:
          "Check your email for instructions to reset your password.",
        duration: 8000,
      });
      setMode("signIn");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFullName("");
    setPassword("");
    setOtp("");
    setOtpSent(false);
  };

  const renderOtpVerification = () => (
    <div className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setMode("signIn");
          setOtpSent(false);
          setOtp("");
        }}
        className="w-full"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Enter Verification Code
        </h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleVerifyOtp} className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(value) => setOtp(value)}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
          disabled={loading || otp.length !== 6}
        >
          {loading ? "Verifying..." : "Verify & Sign In"}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={handleSendOtp}
            className="text-sm text-primary hover:underline"
            disabled={loading}
          >
            Didn't receive the code? Resend
          </button>
        </div>
      </form>
    </div>
  );

  const renderForgotPassword = () => (
    <div className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMode("signIn")}
        className="w-full"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Sign In
      </Button>

      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <KeyRound className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Reset Your Password
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleForgotPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>
    </div>
  );

  const renderAuthForm = () => (
    <div className="space-y-6">
      {/* Logo & Title */}
      <div className="text-center space-y-3">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Activity className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-secondary-foreground" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Aura
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-Powered Wellness Platform
          </p>
        </div>
      </div>

      {/* Auth Tabs */}
      <Tabs
        value={mode === "signUp" ? "signUp" : "signIn"}
        onValueChange={(v) => {
          setMode(v as "signIn" | "signUp");
          resetForm();
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="signIn">Sign In</TabsTrigger>
          <TabsTrigger value="signUp">Sign Up</TabsTrigger>
        </TabsList>

        <TabsContent value="signIn" className="space-y-4">
          {/* Auth Method Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setAuthMethod("password")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                authMethod === "password"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lock className="w-4 h-4" />
              Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod("otp")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                authMethod === "otp"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="w-4 h-4" />
              Email OTP
            </button>
          </div>

          {authMethod === "password" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setMode("forgotPassword")}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
                disabled={loading}
              >
                {loading ? "Sending OTP..." : "Send OTP Code"}
              </Button>
            </form>
          )}
        </TabsContent>

        <TabsContent value="signUp" className="space-y-4">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              A verification email will be sent to confirm your account
            </p>
          </form>
        </TabsContent>
      </Tabs>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground">
        <Shield className="w-4 h-4" />
        <span>Secured with end-to-end encryption</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md p-8 relative backdrop-blur-sm bg-card/95 shadow-xl border-border/50">
        {mode === "otpVerify" && renderOtpVerification()}
        {mode === "forgotPassword" && renderForgotPassword()}
        {(mode === "signIn" || mode === "signUp") && renderAuthForm()}
      </Card>
    </div>
  );
};

export default Auth;
