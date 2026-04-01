import React, { useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

const ResetPasswordPage = () => {

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Validation added
    if (!token || !password) {
      toast.error("Please fill all fields");
      return;
    }

    try {

      await axios.post(
        "http://localhost:8000/api/auth/reset-password",
        {
          token: token.trim(), // remove extra spaces
          new_password: password
        }
      );

      toast.success("Password updated successfully");

      // optional: clear fields
      setToken("");
      setPassword("");

    } catch (error) {

      toast.error(
        error.response?.data?.detail || "Error resetting password"
      );

    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">

      <Card className="w-full max-w-md">

        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>

        <CardContent>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <Label>Reset Token</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste reset token"
              />
            </div>

            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <Button className="w-full">
              Update Password
            </Button>

          </form>

        </CardContent>

      </Card>

    </div>
  );
};

export default ResetPasswordPage;