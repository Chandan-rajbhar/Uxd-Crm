import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { auth, functions } from "src/firebase/config"
import { httpsCallable } from "firebase/functions"
import { useAuth } from "src/contexts/AuthContext"
import { cn } from "src/lib/utils"
import { Button } from "src/components/ui/button"
import { Input } from "src/components/ui/input"
import { Label } from "src/components/ui/label"
import { Alert, AlertDescription } from "src/components/ui/alert"
import { Loader2, Eye, EyeOff } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"form">) {
  const navigate = useNavigate()
  const { refreshRole } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 2FA and Reset States
  const [step, setStep] = useState<'login' | '2fa' | 'forgot-password'>('login')
  const [twoFACode, setTwoFACode] = useState("")
  const [resetEmail, setResetEmail] = useState("")
  const [resetSuccess, setResetSuccess] = useState(false)


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      const tokenResult = await user.getIdTokenResult()
      const isAdmin = tokenResult.claims.role === 'admin'
      const mfaEnabled = tokenResult.claims.mfaEnabled === true

      if (mfaEnabled || isAdmin) {
        // Trigger server-side 2FA code generation (Mandatory for Admin, optional for others if enabled)
        const sendCode = httpsCallable(functions, 'send2FACode')
        await sendCode()
        setStep('2fa')
      } else {
        navigate("/")
      }
    } catch (err: any) {
      console.error("Login failed:", err)
      if (err.code === 'auth/invalid-credential') {
        setError("Invalid email or password.")
      } else if (err.code === 'auth/user-not-found') {
        setError("User not found.")
      } else if (err.code === 'auth/wrong-password') {
        setError("Incorrect password.")
      } else {
        setError("Failed to login. Please try again.")
      }
    } finally {
      if (step === 'login') {
        // Only unset loading if we're not moving to 2fa step (which keeps loading UI? No, we want to show input)
        setLoading(false)
      }
    }
  }

  /* send2FACode function removed */

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Explicitly reject 123456 (backdoor check)
    if (twoFACode === "123456") {
      setError("Invalid verification code.")
      setLoading(false)
      return
    }

    try {
      const verifyCode = httpsCallable(functions, 'verify2FACode')
      await verifyCode({ code: twoFACode })

      // Force refresh to update claims
      if (auth.currentUser) {
        await refreshRole()
      }
      navigate("/")
    } catch (err: any) {
      console.error("2FA Error:", err)
      setError("Invalid verification code.")
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResetSuccess(false)

    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setResetSuccess(true)
    } catch (err: any) {
      console.error("Reset Error:", err)
      if (err.code === 'auth/user-not-found') {
        setError("No account found with this email.")
      } else {
        setError("Failed to send reset email. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (step === 'forgot-password') {
    return (
      <form onSubmit={handleForgotPassword} className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Forgot Password?</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email and we'll send you a link to reset it.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resetSuccess && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <AlertDescription className="text-emerald-800">
              Reset link sent! Please check your inbox.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="reset-email">Email Address</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="Enter your email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || resetSuccess}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send Reset Link
          </Button>
          <Button
            variant="link"
            type="button"
            className="text-muted-foreground"
            onClick={() => {
              setStep('login')
              setError(null)
              setResetSuccess(false)
            }}
          >
            Back to Login
          </Button>
        </div>
      </form>
    )
  }

  if (step === '2fa') {

    return (
      <form onSubmit={handleVerify2FA} className={cn("flex flex-col gap-6", className)} {...props}>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter the code sent to your email.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              placeholder="Enter 6-digit code"
              required
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify
          </Button>
          <Button
            variant="link"
            type="button"
            onClick={() => {
              setStep('login')
              setTwoFACode("")
              setError(null)
            }}
          >
            Back to Login
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleLogin} className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Login to your account</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <Button
              variant="link"
              type="button"
              className="ml-auto inline-block text-xs text-muted-foreground font-medium p-0 h-auto"
              onClick={() => {
                setStep('forgot-password')
                setResetEmail(email)
                setError(null)
              }}
            >
              Forgot your password?
            </Button>
          </div>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="sr-only">
                {showPassword ? "Hide password" : "Show password"}
              </span>
            </Button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? "Logging in..." : "Login"}
        </Button>
      </div>
    </form>
  )
}
