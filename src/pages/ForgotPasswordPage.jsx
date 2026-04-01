import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ForgotPasswordPage = () => {

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);

    try {

      const res = await axios.post(
  "http://localhost:8000/api/auth/forgot-password",
  { email }
);

toast.success("Password reset token generated");

console.log("RESET TOKEN:", res.data.reset_token);
alert("Reset Token: " + res.data.reset_token);

    } catch (error) {

      toast.error(
        error.response?.data?.detail || "Something went wrong"
      );

    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">

      <Card className="w-full max-w-md">

        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">
            Forgot Password
          </CardTitle>

          <CardDescription>
            Enter your email to reset password
          </CardDescription>
        </CardHeader>

        <CardContent>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <Label htmlFor="email">Email</Label>

              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>

              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}

            </Button>

          </form>

          <div className="mt-6 text-center text-sm">

            <span className="text-muted-foreground">
              Remember your password?
            </span>

            <Link
              to="/login"
              className="text-accent hover:underline ml-1"
            >
              Sign in
            </Link>

          </div>

        </CardContent>

      </Card>

    </div>

  );
};

export default ForgotPasswordPage;