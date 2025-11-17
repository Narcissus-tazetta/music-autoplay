import { Alert } from "@shadcn/alert";
import { Button } from "@shadcn/button";
import { Card } from "@shadcn/card";
import { Input } from "@shadcn/input";
import { AlertCircleIcon, Link as LinkIcon, Loader, Send } from "lucide-react";
import { memo } from "react";

export interface MusicFormProps {
  formId: string;
  formErrors?: string;
  urlFieldName: string;
  urlFieldErrors?: string[];
  isSubmitting: boolean;
  hasErrors: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function MusicFormInner({
  formId,
  formErrors,
  urlFieldName,
  urlFieldErrors,
  isSubmitting,
  hasErrors,
  onSubmit,
}: MusicFormProps) {
  return (
    <>
      {formErrors && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <Alert.Title>{formErrors}</Alert.Title>
        </Alert>
      )}
      <Card className="p-6 shadow-sm border border-border/30 hover:border-border/60 transition-colors">
        <Card.Content className="p-0">
          <form
            method="post"
            action="/api/music/add"
            className="flex flex-col items-center gap-4"
            id={formId}
            onSubmit={onSubmit}
          >
            <Input
              leftIcon={<LinkIcon size={18} />}
              name={urlFieldName}
              placeholder="https://www.youtube.com/watch?v=..."
              autoComplete="off"
            />
            {Array.isArray(urlFieldErrors) && urlFieldErrors[0] && (
              <p className="text-destructive text-sm">{urlFieldErrors[0]}</p>
            )}

            <Button type="submit" disabled={hasErrors || isSubmitting}>
              {isSubmitting ? (
                <Loader className="animate-spin" />
              ) : (
                <>
                  <Send />
                  <p>再生リストに追加</p>
                </>
              )}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </>
  );
}

export const MusicForm = memo(MusicFormInner);
