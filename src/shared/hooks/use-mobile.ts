import { useIsMobile as appUseIsMobile } from "~/app/hooks/use-mobile";

export function useIsMobile() {
    return appUseIsMobile();
}
