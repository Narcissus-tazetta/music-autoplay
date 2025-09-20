export const ContactInfo: React.FC = () => {
  return (
    <div
      className="text-xs opacity-80 border-t pt-4 border-zinc-400/30"
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: "100%",
        background: "inherit",
        padding: "16px 24px",
        boxSizing: "border-box",
      }}
    >
      <div>
        <span className="font-bold">お問い合わせ:</span>
        <br />
        📧 Gmail:
        <a
          href="mailto:clownfish11621@gmail.com?subject=%E9%9F%B3%E6%A5%BD%E3%83%AA%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%95%E3%82%A9%E3%83%BC%E3%83%A0%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6"
          className="text-blue-500 hover:underline mx-1"
        >
          clownfish11621@gmail.com
        </a>
        <br /> 💬 Slack:{" "}
        <a
          href="https://n-highschool.slack.com/team/U04VDPX7ZHV"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline mx-1"
        >
          prason
        </a>
        <br />
        <span className="text-gray-500 text-[10px]">
          ※エラーやバグのご報告、ご意見・ご要望は、以下のメールアドレスまたはSlackにてお気軽にご連絡ください。
        </span>
      </div>
    </div>
  );
};
