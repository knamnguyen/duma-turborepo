"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Calendar, Users, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { getDeviceIdentity } from "@/lib/device";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { FormBuilder } from "@/components/form-builder";
import { DEFAULT_FORM_SCHEMA, type FormField } from "@/lib/form-schema";

export default function HomePage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [formSchema, setFormSchema] = useState<FormField[]>(DEFAULT_FORM_SCHEMA);
  const [showFormBuilder, setShowFormBuilder] = useState(false);

  const { isSignedIn, user } = useUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery(trpc.session.list.queryOptions());

  const createMutation = useMutation(
    trpc.session.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.session.list.queryKey() });
        setOpen(false);
        setName("");
        setDate("");
        setDescription("");
        setFormSchema(DEFAULT_FORM_SCHEMA);
        setShowFormBuilder(false);
      },
    })
  );

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-600/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16">
          <div className="absolute top-6 right-6">
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/">
                <Button variant="secondary" size="sm" className="text-xs">Sign in</Button>
              </SignInButton>
            )}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Sessions
            </span>
          </h1>
          <p className="mt-4 text-lg text-white/50 max-w-xl">
            Create interactive sessions where anyone can share moments, photos, and thoughts in real-time.
          </p>

          {isSignedIn ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="mt-8">
                  <Plus className="w-5 h-5" />
                  Create Session
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new session</DialogTitle>
                <DialogDescription>
                  Set up a session for people to share posts and photos.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const creatorDeviceId = getDeviceIdentity().deviceId;
                  createMutation.mutate({ name, date, description, creatorDeviceId, creatorUserId: user?.id, formSchema });
                }}
                className="space-y-4 mt-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Session Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Team Offsite 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea
                    id="desc"
                    placeholder="What's this session about?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                  />
                </div>
                {/* Form builder toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowFormBuilder(!showFormBuilder)}
                    className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors"
                  >
                    {showFormBuilder ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Customize onboarding form
                  </button>
                  {showFormBuilder && (
                    <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <FormBuilder value={formSchema} onChange={setFormSchema} />
                    </div>
                  )}
                </div>

                {createMutation.error && (
                  <p className="text-red-400 text-sm">
                    {createMutation.error.message}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Session"}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          ) : (
            <SignInButton mode="modal" forceRedirectUrl="/">
              <Button size="lg" className="mt-8">
                <Plus className="w-5 h-5" />
                Create Session
              </Button>
            </SignInButton>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {sessionsQuery.isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass rounded-2xl p-6 h-40 animate-pulse"
              />
            ))}
          </div>
        )}

        {sessionsQuery.data && sessionsQuery.data.length === 0 && (
          <div className="text-center py-20 text-white/30">
            <p className="text-lg">No sessions yet. Create one to get started!</p>
          </div>
        )}

        {sessionsQuery.data && sessionsQuery.data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessionsQuery.data.map((session) => (
              <Link
                key={session.id}
                href={`/${session.slug}`}
                className="glass rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300 group animate-fade-in"
              >
                <h3 className="text-lg font-semibold group-hover:text-purple-300 transition-colors">
                  {session.name}
                </h3>
                {session.description && (
                  <p className="mt-2 text-sm text-white/40 line-clamp-2">
                    {session.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-white/30">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {session.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {session._count.posts} posts
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
