import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, join, resolve, normalize } from 'node:path'
import { env } from '@config/env.js'

// =============================================================================
// FinIA — Storage (abstração + implementação local)
// =============================================================================
//
// Decisão aprovada (§10 Sprint 4): storage local com ABSTRAÇÃO para
// S3-compatible. O resto do sistema fala com a interface IStorage e guarda
// apenas caminhos RELATIVOS (portáveis) — trocar para S3 é implementar a
// interface e trocar o export, sem tocar em quem usa.
//
// =============================================================================

export interface SavedFile {
  /** Caminho relativo (o que vai para o banco em Report.filePath) */
  relativePath: string
  /** Tamanho em bytes */
  size: number
}

export interface IStorage {
  save(relativePath: string, content: string | Buffer): Promise<SavedFile>
  read(relativePath: string): Promise<Buffer>
}

class LocalStorage implements IStorage {
  private readonly basePath: string

  constructor(basePath: string) {
    this.basePath = resolve(basePath)
  }

  /** Resolve dentro do basePath e bloqueia path traversal (../..). */
  private safePath(relativePath: string): string {
    const full = resolve(join(this.basePath, normalize(relativePath)))
    if (!full.startsWith(this.basePath)) {
      throw new Error(`Storage: caminho fora do diretório base: ${relativePath}`)
    }
    return full
  }

  async save(relativePath: string, content: string | Buffer): Promise<SavedFile> {
    const full = this.safePath(relativePath)
    await mkdir(dirname(full), { recursive: true })
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content
    await writeFile(full, buffer)
    return { relativePath, size: buffer.byteLength }
  }

  async read(relativePath: string): Promise<Buffer> {
    const full = this.safePath(relativePath)
    await stat(full) // ENOENT explícito antes de ler
    return readFile(full)
  }
}

/** Implementação ativa (S3-compatible entraria aqui via env no futuro). */
export const storage: IStorage = new LocalStorage(env.STORAGE_PATH)
