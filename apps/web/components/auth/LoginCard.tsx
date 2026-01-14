"use client";

import { Button } from "@bullstudio/ui/components/button";
import { Card, CardContent } from "@bullstudio/ui/components/card";
import { Input } from "@bullstudio/ui/components/input";
import { Separator } from "@bullstudio/ui/components/separator";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { signIn } from "@bullstudio/auth/react";
import { Field, FieldError } from "@bullstudio/ui/components/field";
import { toast } from "@bullstudio/ui/components/sonner";

type AuthProvider = {
  type: "google" | "github";
  label: string;
  iconPath: string;
  action: () => Promise<void>;
};

const authProviders: AuthProvider[] = [
  {
    type: "google",
    label: "Continue with Google",
    iconPath: "/icons/google.svg",
    action: () => signIn("google"),
  },
  {
    type: "github",
    label: "Continue with GitHub",
    iconPath: "/icons/github.svg",
    action: () => signIn("github"),
  },
];

const magicLinkSchema = z.object({
  email: z.email("Invalid email address"),
});

export const LoginCard = () => {
  const { formState, handleSubmit, control } = useForm({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
    mode: "onChange",
  });

  const magicLinkSignIn = async (data: z.infer<typeof magicLinkSchema>) => {
    await signIn("resend", {
      email: data.email,
    });
    toast.success("Magic link sent to your email");
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {authProviders.map((provider) => (
            <Button
              className="w-full"
              variant="outline"
              key={provider.type}
              onClick={provider.action}
            >
              <Image
                src={provider.iconPath}
                alt={provider.type}
                width={13}
                height={13}
              />
              {provider.label}
            </Button>
          ))}
        </div>
        <div className="relative w-full py-2">
          <Separator />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="text-sm px-2 bg-card text-muted-foreground">
              or
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Sign in via magic link
        </p>

        <form
          onSubmit={handleSubmit(magicLinkSignIn)}
          className="flex flex-col gap-3"
        >
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Input {...field} placeholder="Email" />
                {fieldState.error && (
                  <FieldError errors={[fieldState.error]}></FieldError>
                )}
              </Field>
            )}
          />

          <Button
            //loading={formState.isSubmitting}
            disabled={formState.isSubmitting || !formState.isValid}
            className="w-full"
            type="submit"
            variant="default"
          >
            Send magic link
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
