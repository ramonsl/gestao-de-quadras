/**
 * Interface de envio de e-mails transacionais.
 * Todas as implementações concretas devem satisfazer este contrato,
 * permitindo troca de provedor sem alterar o código consumidor.
 */
export interface EmailProvider {
  sendActivationEmail(params: { to: string; activationUrl: string; arenaName: string }): Promise<void>;
  sendPasswordResetEmail(params: { to: string; resetUrl: string; arenaName: string }): Promise<void>;
}

/**
 * Implementação do EmailProvider usando o SDK do Resend.
 * Instanciar uma vez e injetar onde necessário.
 */
export class ResendEmailProvider implements EmailProvider {
  private readonly resend: { emails: { send: (payload: unknown) => Promise<{ error: unknown }> } };
  private readonly fromAddress: string;

  constructor(apiKey: string, fromAddress = "noreply@arena.sistema.com.br") {
    // Import dinâmico para evitar erro em ambientes que não têm a variável configurada
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resend } = require("resend");
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async sendActivationEmail(params: {
    to: string;
    activationUrl: string;
    arenaName: string;
  }): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: params.to,
      subject: `Ative sua conta — ${params.arenaName}`,
      html: buildActivationEmailHtml(params.activationUrl, params.arenaName),
    });

    if (error) {
      throw new Error(`Falha ao enviar e-mail de ativação: ${JSON.stringify(error)}`);
    }
  }

  async sendPasswordResetEmail(params: {
    to: string;
    resetUrl: string;
    arenaName: string;
  }): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: params.to,
      subject: `Redefinição de senha — ${params.arenaName}`,
      html: buildResetEmailHtml(params.resetUrl, params.arenaName),
    });

    if (error) {
      throw new Error(`Falha ao enviar e-mail de recuperação: ${JSON.stringify(error)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Templates de e-mail (HTML mínimo, operacional, sem marketing)
// ---------------------------------------------------------------------------

function buildActivationEmailHtml(activationUrl: string, arenaName: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1916;">
      <h2 style="font-size: 18px; margin-bottom: 8px;">${arenaName} — Ative sua conta</h2>
      <p style="font-size: 14px; color: #4a4845;">
        Sua conta foi criada por um administrador da arena. Clique no botão abaixo
        para definir sua senha e ativar o acesso.
      </p>
      <a href="${activationUrl}"
         style="display: inline-block; margin: 20px 0; padding: 12px 24px;
                background: oklch(0.48 0.13 255); color: #fff; text-decoration: none;
                border-radius: 9px; font-size: 14px; font-weight: 600;">
        Ativar conta
      </a>
      <p style="font-size: 11px; color: #9a9895;">
        Link válido por 48 horas. Se você não solicitou este acesso, ignore este e-mail.
      </p>
    </div>
  `;
}

function buildResetEmailHtml(resetUrl: string, arenaName: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1916;">
      <h2 style="font-size: 18px; margin-bottom: 8px;">${arenaName} — Redefinição de senha</h2>
      <p style="font-size: 14px; color: #4a4845;">
        Recebemos uma solicitação de redefinição de senha para sua conta.
        Clique no botão abaixo para definir uma nova senha.
      </p>
      <a href="${resetUrl}"
         style="display: inline-block; margin: 20px 0; padding: 12px 24px;
                background: oklch(0.48 0.13 255); color: #fff; text-decoration: none;
                border-radius: 9px; font-size: 14px; font-weight: 600;">
        Redefinir senha
      </a>
      <p style="font-size: 11px; color: #9a9895;">
        Link válido por 24 horas. Se você não solicitou isto, ignore este e-mail.
      </p>
    </div>
  `;
}
