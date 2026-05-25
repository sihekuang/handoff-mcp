class HandoffMcp < Formula
  desc "AI agent handoff server — MCP + REST + web UI"
  homepage "https://github.com/sihekuang/handoff-mcp"
  url "https://github.com/sihekuang/handoff-mcp/releases/download/v0.2.1/handoff-mcp-0.2.1.tar.gz"
  sha256 "a4a8171e81aaaea76ef8f73d3eedbf1e12c31333d5d935ec40bb01399527a822"
  license "MIT"

  depends_on "node@24"

  def install
    libexec.install Dir["*"]
    (bin/"handoff").write_env_script libexec/"bin/handoff",
      PATH: "#{Formula["node@24"].opt_bin}:$PATH"
  end

  service do
    run [opt_bin/"handoff", "start"]
    keep_alive true
    working_dir var/"handoff-mcp"
    log_path var/"log/handoff-mcp.log"
    error_log_path var/"log/handoff-mcp.log"
  end

  test do
    assert_match "handoff-mcp", shell_output("#{bin}/handoff 2>&1")
  end
end
