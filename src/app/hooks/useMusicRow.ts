import { useState } from "react";

interface UseMusicRowOptions {
  musicId: string;
  requesterHash?: string;
  userHash?: string;
  isAdmin: boolean;
  onDelete: (id: string, isAdmin?: boolean) => void;
}

export function useMusicRow({
  musicId,
  requesterHash,
  userHash,
  isAdmin,
  onDelete,
}: UseMusicRowOptions) {
  const [isExpanded, setIsExpanded] = useState(false);
  const canDelete = isAdmin || (requesterHash && userHash === requesterHash);

  const handleDelete = () => {
    onDelete(musicId);
  };

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return {
    isExpanded,
    canDelete,
    handleDelete,
    toggleExpanded,
  };
}
