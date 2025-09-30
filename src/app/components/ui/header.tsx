import { Button } from "@shadcn/button";
import { Sheet } from "@shadcn/sheet";
import { SlidersHorizontalIcon } from "lucide-react";
import { Form, Link } from "react-router";
import { Settings } from "~/components/ui/settings";
import { DropdownMenu } from "~/components/ui/shadcn/dropdown-menu";
import { useAdminStore } from "../../../shared/stores/adminStore";
import AdminStatus from "./adminStatus";

const developers = [
  {
    name: "Narcissus-tazetta",
    slack: "https://n-highschool.slack.com/archives/D088N1A4WET",
    github: "https://github.com/narcissus-tazetta",
  },
  {
    name: "Alinco8",
    slack: "https://n-highschool.slack.com/archives/D06QV02HW30",
    github: "https://github.com/alinco8",
  },
];

export interface HeaderProps {
  userName?: string;
}
export const Header = ({ userName }: HeaderProps) => {
  const isAdmin = useAdminStore((s) => s.isAdmin);
  return (
    <div className="flex items-center justify-between w-full p-4 border-b border-gray-200 dark:border-gray-700">
      <Link className="text-2xl font-bold font-[Dancing_Script] pl-4" to="/">
        Music Autoplay
      </Link>
      <div className="flex items-center gap-2">
        <AdminStatus />
        {(() => {
          const showLogout = Boolean(userName) || isAdmin;
          if (showLogout) {
            return (
              <div className="flex items-center gap-2">
                {userName && (
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {userName} でログイン中
                  </span>
                )}
                <Form action="/auth/logout" method="post">
                  <Button
                    type="submit"
                    variant="outline"
                    onClick={() => {
                      try {
                        if (isAdmin) useAdminStore.getState().logout();
                      } catch (err) {
                        if (process.env.NODE_ENV !== "production")
                          console.error(err);
                      }
                    }}
                  >
                    ログアウト
                  </Button>
                </Form>
              </div>
            );
          }
          return (
            <Form action="/auth/login" method="post">
              <Button type="submit" variant="outline">
                Googleでログイン
              </Button>
            </Form>
          );
        })()}
        <Sheet>
          <Sheet.Trigger asChild>
            <Button variant="outline" size="icon">
              <SlidersHorizontalIcon />
            </Button>
          </Sheet.Trigger>
          <Sheet.Content side="right" className="w-80">
            <Sheet.Header>
              <Sheet.Title>設定</Sheet.Title>
              <Sheet.Description>
                ここでは、アプリケーションの動作や外観をカスタマイズできます。
              </Sheet.Description>
            </Sheet.Header>
            <Settings />
            <Sheet.Footer>
              <span className="text-xs">
                © 2025{" "}
                {developers.map((dev, i) => (
                  <>
                    <DropdownMenu key={dev.name}>
                      <DropdownMenu.Trigger className="text-blue-500 dark:text-purple-400 hover:underline">
                        {dev.name}
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <DropdownMenu.Group>
                          <DropdownMenu.Item>
                            <a
                              href={dev.slack}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Slack
                            </a>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item>
                            <a
                              href={dev.github}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              GitHub
                            </a>
                          </DropdownMenu.Item>
                        </DropdownMenu.Group>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                    {i < developers.length - 1 && ", "}
                  </>
                ))}
              </span>
            </Sheet.Footer>
          </Sheet.Content>
        </Sheet>
      </div>
    </div>
  );
};
