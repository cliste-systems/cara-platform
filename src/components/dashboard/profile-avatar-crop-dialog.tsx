"use client";
import { FormFeedback } from "@/components/ui/form-feedback";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedImageBlob } from "@/lib/crop-image";
import { cn } from "@/lib/utils";

type ProfileAvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (file: File) => void;
};

export function ProfileAvatarCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onApply,
}: ProfileAvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleApply() {
    if (!imageSrc) return;
    if (!croppedAreaPixels) {
      setError("Adjust the crop, then try again.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], "avatar.webp", { type: "image/webp" });
      onApply(file);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop image.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          setZoom(1);
          setCrop({ x: 0, y: 0 });
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="z-[80] gap-0 overflow-hidden p-0 sm:max-w-md"
        overlayClassName="z-[80]"
      >
        <DialogHeader className="space-y-1 border-b border-slate-200 px-5 py-4 pr-12">
          <DialogTitle className="text-[15px] text-[#0b1220]">
            Crop profile photo
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-slate-500">
            Drag to reposition and use the slider to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-80 bg-[#0b1220]">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="space-y-4 border-t border-slate-200 px-5 py-4">
          <label className="flex items-center gap-3 text-[12px] font-medium text-slate-600">
            <span className="w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[#0b1220]"
            />
          </label>
          {error ? (
            <FormFeedback message={error} />
          ) : null}

          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-w-[5.5rem]"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn(
                "min-w-[5.5rem] bg-[#0b1220] text-white hover:bg-[#0b1220]/90",
              )}
              disabled={pending || !imageSrc}
              onClick={() => void handleApply()}
            >
              {pending ? "Applying…" : "Apply"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
