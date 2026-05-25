class HandoffMcp < Formula
  desc "AI agent handoff server — MCP + REST + web UI"
  homepage "https://github.com/sihekuang/handoff-mcp"
  url "https://github.com/sihekuang/handoff-mcp/releases/download/v0.2.3/handoff-mcp-0.2.3.tar.gz"
  sha256 "9737dea5f4cf39f91a06aa318fe44f8ae8afcdb1f50e2dc34960add46bb9cb1e"
  license "MIT"

  depends_on "node@24"

  def install
    libexec.install Dir["*"], Dir[".*"].reject { |f| %w[. ..].include?(f) }
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
