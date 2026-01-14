# 🪙 Nonce Wallet

Uma carteira Bitcoin moderna e segura desenvolvida com Angular e Ionic, oferecendo suporte completo para endereços Taproot (BIP86), a versão mais atualizada e eficiente da rede Bitcoin.

## 📋 Sobre o Projeto

O **Nonce Wallet** é uma aplicação de carteira Bitcoin que permite aos usuários criar, gerenciar e realizar transações com Bitcoin de forma segura e intuitiva. O projeto foi desenvolvido como uma Progressive Web App (PWA) usando Ionic Framework, permitindo que funcione tanto em navegadores quanto em dispositivos móveis Android através do Capacitor.

### ✨ Funcionalidades Principais

- **Criação de Carteiras**: Gere novas carteiras Bitcoin com seed de 12 palavras (BIP39)
- **Importação de Carteiras**: Importe carteiras existentes de outras aplicações usando seed phrase
- **Compatibilidade Total com Outras Carteiras**: Suporte completo a padrões BIP39, BIP32, BIP44 e BIP86
- **Taproot (BIP86)**: Padrão mais moderno e eficiente, reduz taxas significativamente, oferece maior privacidade e permite enviar Bitcoin para qualquer tipo de endereço (SegWit, Legacy, etc.)
- **Envio de Bitcoin**: Envie Bitcoin para qualquer endereço com cálculo automático de taxas
- **Recebimento de Bitcoin**: Gere endereços QR Code para receber pagamentos
- **Histórico de Transações**: Visualize todas as transações da carteira
- **Gerenciamento de Múltiplas Carteiras**: Crie e gerencie várias carteiras simultaneamente
- **Armazenamento Local Seguro**: Dados armazenados localmente no dispositivo

## 🔐 Sobre Taproot

**Taproot (BIP86)** é a atualização mais recente e moderna do protocolo Bitcoin, ativada em novembro de 2021. Esta carteira oferece suporte completo a Taproot, proporcionando:

### Vantagens do Taproot:

- **Taxas Mais Baixas**: Reduz as taxas de transação significativamente comparado a outros tipos de endereço
- **Maior Privacidade**: Transações Taproot são indistinguíveis de outras transações Taproot na blockchain
- **Maior Eficiência**: Transações mais leves e rápidas
- **Compatibilidade Total**: Você pode enviar Bitcoin para qualquer tipo de endereço (SegWit, Legacy, Taproot, etc.)
- **Futuro do Bitcoin**: Padrão recomendado para novas carteiras e transações

### Comparação de Tipos de Endereço:

| Tipo | Prefixo | Taxa Estimada | Privacidade | Compatibilidade |
|------|---------|---------------|-------------|-----------------|
| **Legacy (P2PKH)** | `1...` | 100% (base) | Baixa | Universal |
| **SegWit (BIP84)** | `bc1...` (42 chars) | ~60% | Média | Alta |
| **Taproot (BIP86)** | `bc1p...` (62 chars) | ~45-50% | Alta | Crescendo |

**Nota**: Esta carteira suporta apenas Taproot (BIP86), que é o padrão mais moderno e eficiente.

## 🛠️ Tecnologias Utilizadas

### Frontend
- **Angular 20**: Framework principal
- **Ionic 8**: Framework para desenvolvimento mobile/híbrido

### Blockchain & Criptografia
- **bitcoinjs-lib 7.0**: Biblioteca para manipulação de transações Bitcoin
- **bip39**: Implementação completa do padrão BIP39 para mnemônicos
- **bip32**: Derivação hierárquica determinística (HD Wallets)
- **ecpair 3.0**: Geração e manipulação de pares de chaves
- **tiny-secp256k1 2.2**: Criptografia de curva elíptica

### Mobile
- **Capacitor 8**: Bridge nativo para Android/iOS
- **@capacitor/android 8.0**: Suporte Android

### UI/UX
- **Ionicons 7.0**: Ícones
- **SweetAlert2 11.26**: Alertas e modais

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior) - [Download](https://nodejs.org/)
- **npm** (geralmente vem com Node.js) ou **yarn**
- **Angular CLI** (será instalado globalmente ou via npx)
- **Ionic CLI** (será instalado globalmente ou via npx)
- **Git** - [Download](https://git-scm.com/)

### Para Desenvolvimento Mobile (Android)

- **Android Studio** - [Download](https://developer.android.com/studio)
- **Android SDK** (instalado via Android Studio)
- **Gradle** (geralmente vem com Android Studio)

## 🚀 Instalação e Configuração

### Passo 1: Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/NonceWallet.git
cd NonceWallet
```

### Passo 2: Instalar Dependências

Instale todas as dependências do projeto usando npm:

```bash
npm install
```

**Nota**: Este processo pode levar alguns minutos, pois o npm baixará todas as dependências necessárias.

### Passo 3: Verificar Instalação

Verifique se tudo foi instalado corretamente:

```bash
npm list --depth=0
```

## 🏃 Como Executar o Projeto

### Modo Desenvolvimento (Web)

Para executar o projeto em modo de desenvolvimento com hot-reload:

```bash
ionic serve
```

O aplicativo estará disponível em: **http://localhost:8100**

O servidor de desenvolvimento recarrega automaticamente quando você faz alterações nos arquivos.

## 🔧 Configurações Importantes

### Capacitor Config (`capacitor.config.ts`)

```typescript
{
  appId: 'br.com.danielamaro.nonce',
  appName: 'Nonce Wallet',
  webDir: 'www'
}
```

### Rede Bitcoin

O projeto está configurado para usar a **rede principal do Bitcoin (Mainnet)**. Para usar a rede de teste, modifique o `network` nos serviços:

```typescript
private network = bitcoin.networks.testnet  // Para testnet
private network = bitcoin.networks.bitcoin   // Para mainnet (padrão)
```

## 🔑 Funcionalidades Técnicas

### Geração de Carteiras

- **BIP39 Completo**: Implementação completa do padrão BIP39
  - Geração de mnemônicos com entropia criptograficamente segura
  - Validação de checksum BIP39
  - Derivação de seed usando PBKDF2 com HMAC-SHA512 (2048 iterações)
  - Compatível com todas as carteiras que seguem o padrão BIP39
- **BIP32 (HD Wallets)**: Derivação hierárquica determinística de chaves
- **BIP44**: Suporte a caminhos de derivação padrão para Bitcoin
- **BIP86 (Taproot)**: Endereços `bc1p...` (62 caracteres) - caminho `m/86'/0'/0'/0/0`

### Transações

- **UTXO Selection**: Seleção automática de UTXOs para transações
- **Cálculo de Taxas**: Cálculo dinâmico baseado na rede
- **PSBT (Partially Signed Bitcoin Transactions)**: Construção segura de transações
- **Witness Data**: Suporte completo para Taproot witness

### Segurança

- **Armazenamento Local**: Chaves privadas armazenadas localmente (não enviadas para servidores)
- **Validação de Seeds**: Validação completa BIP39 (palavras e checksum)
- **Validação de Endereços**: Verificação de formato e checksum
- **Derivação Segura**: Uso de PBKDF2 com 2048 iterações para derivação de seeds

## 🔄 Compatibilidade com Outras Carteiras

O **Nonce Wallet** implementa os padrões Bitcoin mais amplamente adotados, garantindo total compatibilidade com outras carteiras populares.

### ✅ Compatibilidade

**Importação**: Você pode importar seeds de carteiras Taproot (BIP86) que seguem o padrão BIP39.

**Envio**: Carteiras Taproot podem enviar Bitcoin para qualquer tipo de endereço, incluindo:
- Carteiras SegWit (BIP84) como BlueWallet, Electrum, Trust Wallet, Coinbase Wallet
- Carteiras Legacy
- Outras carteiras Taproot
- Qualquer endereço Bitcoin válido

### 📋 Como Importar uma Carteira

1. **Obtenha sua seed phrase** (12 palavras) da carteira original
2. **No Nonce Wallet**, vá em "Importar Carteira"
3. **Importante**: Esta carteira suporta apenas Taproot (BIP86). Se sua carteira original usa SegWit (BIP84), você precisará usar outra carteira para importá-la
4. **Digite ou cole as 12 palavras do seed** (deve ser uma carteira Taproot)
5. **Importe e acesse seus fundos**

### ⚠️ Importante na Importação

- **Esta carteira suporta apenas Taproot (BIP86)**: Se sua carteira original usa SegWit (BIP84), você não poderá importá-la diretamente
- **Carteiras Taproot podem enviar para qualquer endereço**: Mesmo que você tenha uma carteira Taproot, você pode enviar Bitcoin para carteiras SegWit, Legacy ou qualquer outro tipo de endereço

### 🔐 Padrões Implementados

| BIP | Status | Descrição |
|-----|--------|-----------|
| **BIP39** | ✅ Completo | Mnemônicos e derivação de seeds |
| **BIP32** | ✅ Implementado | HD Wallets (carteiras hierárquicas) |
| **BIP44** | ✅ Suportado | Caminhos de derivação padrão |
| **BIP86** | ✅ Completo | Taproot (endereços `bc1p...`) |
| **BIP174** | ✅ Completo | PSBT (transações parcialmente assinadas) |

## 🌐 APIs Utilizadas

O projeto utiliza as seguintes APIs públicas para consulta de dados da blockchain:

- **Blockstream API**: Consulta de UTXOs, transações e histórico
- **Mempool.space API**: Taxas recomendadas e dados da rede

**Nota**: As chaves privadas nunca são enviadas para essas APIs. Apenas endereços públicos são consultados.

## ⚠️ Avisos Importantes

### Segurança

- **NUNCA compartilhe sua seed phrase** com ninguém
- **SEMPRE faça backup** da sua seed phrase em local seguro
- **NÃO use este código em produção** sem auditoria de segurança adequada
- As chaves privadas são armazenadas localmente - **proteja seu dispositivo**

### Desenvolvimento

- Este é um projeto educacional/demonstrativo
- Para uso em produção, considere:
  - Auditoria de segurança
  - Testes extensivos
  - Implementação de backup em nuvem criptografado
  - Suporte a hardware wallets

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um Fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença especificada no arquivo `LICENSE`.

## 👤 Autor

**Daniel Amaro**

- GitHub: [@seu-usuario](https://github.com/seu-usuario)

## 🙏 Agradecimentos

- [BitcoinJS](https://github.com/bitcoinjs/bitcoinjs-lib) - Biblioteca Bitcoin para JavaScript
- [Ionic Framework](https://ionicframework.com/) - Framework mobile
- [Angular](https://angular.io/) - Framework web
- Comunidade Bitcoin

## 📚 Recursos Adicionais

### Documentação Bitcoin e BIPs

- [Documentação Bitcoin](https://bitcoin.org/en/developer-documentation)
- [BIP32 - HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP39 - Mnemonic Code](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP44 - Multi-Account Hierarchy](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [BIP86 - Taproot](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki)
- [BIP174 - PSBT](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki)

### Frameworks e Bibliotecas

- [Documentação Ionic](https://ionicframework.com/docs)
- [Documentação Angular](https://angular.io/docs)
- [BitcoinJS Library](https://github.com/bitcoinjs/bitcoinjs-lib)

---

**⚠️ Disclaimer**: Este software é fornecido "como está", sem garantias. Use por sua conta e risco. Sempre faça backup das suas chaves privadas e seeds.
