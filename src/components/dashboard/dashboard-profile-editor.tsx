"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  removeUserProfileAvatar,
  updateUserProfile,
} from "@/app/(dashboard)/dashboard/profile-actions";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { DashboardProfileAvatar } from "@/components/dashboard/dashboard-profile-avatar";
import { ProfileAvatarCropDialog } from "@/components/dashboard/profile-avatar-crop-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFILE_AVATAR_FILE_ACCEPT } from "@/lib/profile-avatar";
import { prepareProfileImageFile } from "@/lib/prepare-profile-image-file";
import { cn } from "@/lib/utils";

export type ProfileSaveResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; message: string };

export type DashboardProfileEditorHandle = {
  saveIfDirty: () => Promise<ProfileSaveResult>;
};

type DashboardProfileEditorProps = {
  initialName: string;
  initials: string;
  avatarUrl: string | null;
  subtitle: string;
  showSettingsLink?: boolean;
  /** When true, the page-level Save changes button persists profile edits. */
  deferSaveToParent?: boolean;
  onSaved?: () => void;
  className?: string;
};

export const DashboardProfileEditor = forwardRef<
  DashboardProfileEditorHandle,
  DashboardProfileEditorProps
>(function DashboardProfileEditor(
  {
    initialName,
    initials,
    avatarUrl,
    subtitle,
    showSettingsLink = false,
    deferSaveToParent = false,
    onSaved,
    className,
  },
  ref,
) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(avatarUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removePending, startRemoveTransition] = useTransition();

  useEffect(() => {
    setName(initialName);
    setSavedAvatarUrl(avatarUrl);
  }, [initialName, avatarUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function persistProfile(): Promise<ProfileSaveResult> {
    const trimmedName = name.trim();
    const nameChanged = trimmedName !== initialName.trim();
    if (!pendingFile && !nameChanged) {
      return { ok: true, skipped: true };
    }

    const formData = new FormData();
    formData.set("name", trimmedName);
    const result = await updateUserProfile(pendingFile, formData);

    if (!result.ok) {
      return { ok: false, message: result.message };
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    if (result.avatarUrl) {
      setSavedAvatarUrl(result.avatarUrl);
    }
    router.refresh();
    onSaved?.();
    return { ok: true };
  }

  useImperativeHandle(ref, () => ({ saveIfDirty: persistProfile }), [
    name,
    pendingFile,
    previewUrl,
    initialName,
    deferSaveToParent,
    onSaved,
    router,
  ]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    void (async () => {
      setMessage(null);
      try {
        const prepared = await prepareProfileImageFile(file);
        const objectUrl = URL.createObjectURL(prepared);
        setCropSrc(objectUrl);
        setCropOpen(true);
      } catch {
        setMessage(
          "Could not open that photo. Try exporting it as JPEG from Photos, or pick a PNG or WebP file.",
        );
      }
    })();
  }

  function handleCropped(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);
    setPendingFile(file);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function saveProfile() {
    setMessage(null);
    startTransition(async () => {
      const result = await persistProfile();
      if (result.ok) {
        if (!result.skipped) setMessage("Profile saved.");
      } else {
        setMessage(result.message);
      }
    });
  }

  function removePhoto() {
    setMessage(null);
    startRemoveTransition(async () => {
      const result = await removeUserProfileAvatar();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingFile(null);
      setSavedAvatarUrl(null);
      setMessage("Photo removed.");
      router.refresh();
      onSaved?.();
    });
  }

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");
  const hasPhoto = Boolean(previewUrl || savedAvatarUrl);
  const hasUnsavedProfile = Boolean(pendingFile) || name.trim() !== initialName.trim();

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <DashboardProfileAvatar
          initials={initials}
          avatarUrl={savedAvatarUrl}
          previewUrl={previewUrl}
          size="md"
        />
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={openFilePicker}
            >
              Change photo
            </Button>
            {hasPhoto ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-[12px] text-slate-600"
                disabled={removePending || pending}
                onClick={removePhoto}
              >
                {removePending ? "Removing…" : "Remove photo"}
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] leading-snug text-slate-500">{subtitle}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={PROFILE_AVATAR_FILE_ACCEPT}
        className="sr-only"
        onChange={handleFileSelected}
      />

      <div className="space-y-1.5">
        <Label htmlFor="profile-display-name">Display name</Label>
        <Input
          id="profile-display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className={fieldClass}
        />
      </div>

      <FormFeedback message={message} tone={message?.includes("saved") || message?.includes("removed") ? "success" : "error"} title={message?.includes("saved") || message?.includes("removed") ? "Updated" : "Please check this"} />

      {deferSaveToParent ? (
        hasUnsavedProfile ? (
          <p className="text-[11px] leading-snug text-slate-500">
            Unsaved profile changes — use{" "}
            <span className="font-medium text-slate-600">Save changes</span> at
            the top of this page.
          </p>
        ) : null
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={pending || removePending}
              onClick={saveProfile}
              className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9 px-4 text-[13px]")}
            >
              {pending ? "Saving…" : "Save profile"}
            </Button>
            {showSettingsLink ? (
              <Link
                href="/dashboard/settings"
                className="text-[12px] font-medium text-slate-600 underline-offset-2 hover:text-[#0b1220] hover:underline"
              >
                Account settings
              </Link>
            ) : null}
          </div>
        </div>
      )}

      <ProfileAvatarCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open && cropSrc) {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }
        }}
        onApply={handleCropped}
      />
    </div>
  );
});
