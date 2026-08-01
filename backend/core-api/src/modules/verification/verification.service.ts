import { findOrFail } from '@finance-crm/common';
import {
  BankAccountStatus,
  CustomerBanking,
  Document,
  DocumentDownloadLog,
  DocumentType,
  Lead,
  User,
} from '@finance-crm/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertLeadEditableBySupport } from '../../common/lead-editable.util';
import { CreateCustomerBankingDto } from './dto/create-customer-banking.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';

/**
 * Legacy code (`DisbursalController::verifyDisbursalBank()`,
 * `addBeneficiary()`) special-cases id `1` as "verified" everywhere it
 * checks the value, and resets sibling records on the same lead back to
 * `0` when a new one is verified — see `BankAccountStatus`'s doc comment
 * for the full confirmed 5-row label set.
 */
const BANK_ACCOUNT_STATUS_VERIFIED = 1;
const BANK_ACCOUNT_STATUS_UNVERIFIED = 0;

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(CustomerBanking)
    private readonly customerBankingRepository: Repository<CustomerBanking>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentDownloadLog)
    private readonly documentDownloadLogRepository: Repository<DocumentDownloadLog>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(BankAccountStatus)
    private readonly bankAccountStatusRepository: Repository<BankAccountStatus>,
  ) {}

  // Document types
  listDocumentTypes(): Promise<DocumentType[]> {
    return this.documentTypeRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findDocumentTypeById(id: number): Promise<DocumentType> {
    return findOrFail(this.documentTypeRepository, id, 'Document type');
  }

  createDocumentType(dto: CreateDocumentTypeDto): Promise<DocumentType> {
    const now = new Date();
    const documentType = this.documentTypeRepository.create({
      name: dto.name,
      isRequired: dto.isRequired ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return this.documentTypeRepository.save(documentType);
  }

  async updateDocumentType(
    id: number,
    dto: UpdateDocumentTypeDto,
  ): Promise<DocumentType> {
    const documentType = await this.findDocumentTypeById(id);
    if (dto.name !== undefined) documentType.name = dto.name;
    if (dto.isRequired !== undefined) documentType.isRequired = dto.isRequired;
    documentType.updatedAt = new Date();
    return this.documentTypeRepository.save(documentType);
  }

  async removeDocumentType(id: number): Promise<void> {
    const documentType = await this.findDocumentTypeById(id);
    documentType.isActive = false;
    documentType.isDeleted = true;
    await this.documentTypeRepository.save(documentType);
  }

  // Customer banking
  async listBanking(leadId: number): Promise<CustomerBanking[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.customerBankingRepository.find({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
  }

  async createBanking(
    leadId: number,
    dto: CreateCustomerBankingDto,
  ): Promise<CustomerBanking> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const banking = this.customerBankingRepository.create({
      lead,
      bankName: dto.bankName,
      ifscCode: dto.ifscCode,
      accountNumber: dto.accountNumber,
      confirmAccountNumber: dto.confirmAccountNumber,
      beneficiaryName: dto.beneficiaryName ?? null,
      branch: dto.branch ?? null,
    });
    return this.customerBankingRepository.save(banking);
  }

  /** The full `master_bank_account_status` picker — see `BankAccountStatus`'s
   * doc comment for the confirmed 5-row label set this now exposes. */
  listBankAccountStatuses(): Promise<BankAccountStatus[]> {
    return this.bankAccountStatusRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Ports `DisbursalController::verifyDisbursalBank()`'s verify-only path
   * (`verification_type_id == 1`) — the single "verified" transition the
   * existing `PATCH :bankingId/verify` route commits to. Delegates to
   * `setBankAccountStatus()` for the actual sibling-reset logic.
   */
  verifyBanking(leadId: number, bankingId: number): Promise<CustomerBanking> {
    return this.setBankAccountStatus(
      leadId,
      bankingId,
      BANK_ACCOUNT_STATUS_VERIFIED,
    );
  }

  /**
   * Ports `DisbursalController::verifyDisbursalBank()`'s full status-picker
   * path (arbitrary `master_bank_account_status` values, not just the
   * verify-only boolean toggle) — see `BankAccountStatus`'s doc comment for
   * the confirmed label set. Resets every other bank account on the lead
   * back to unverified only when the target status is "verified" (id `1`)
   * — legacy's own sibling-reset rule, not applied for any other status.
   */
  async setBankAccountStatus(
    leadId: number,
    bankingId: number,
    accountStatusId: number,
  ): Promise<CustomerBanking> {
    const status = await findOrFail(
      this.bankAccountStatusRepository,
      accountStatusId,
      'Bank account status',
    );
    const banking = await this.customerBankingRepository.findOne({
      where: { id: bankingId, lead: { id: leadId } },
    });
    if (!banking) {
      throw new NotFoundException(
        `Bank account ${bankingId} not found for lead ${leadId}`,
      );
    }
    if (status.id === BANK_ACCOUNT_STATUS_VERIFIED) {
      await this.customerBankingRepository.update(
        { lead: { id: leadId }, accountStatusId: BANK_ACCOUNT_STATUS_VERIFIED },
        { accountStatusId: BANK_ACCOUNT_STATUS_UNVERIFIED },
      );
    }
    banking.accountStatusId = status.id;
    return this.customerBankingRepository.save(banking);
  }

  // Documents
  async listDocuments(leadId: number): Promise<Document[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.documentRepository.find({
      where: { lead: { id: leadId } },
      relations: { documentType: true, uploadedBy: true },
      order: { id: 'DESC' },
    });
  }

  async uploadDocument(
    leadId: number,
    dto: CreateDocumentDto,
    actingUserId: number,
  ): Promise<Document> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const uploadedBy = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const document = this.documentRepository.create({
      lead,
      uploadedBy,
      filePath: dto.filePath,
      documentType: dto.documentTypeId
        ? await findOrFail(
            this.documentTypeRepository,
            dto.documentTypeId,
            'Document type',
          )
        : null,
      createdAt: new Date(),
    });
    return this.documentRepository.save(document);
  }

  async recordDownload(
    leadId: number,
    documentId: number,
    actingUserId: number,
    ipAddress: string | undefined,
    userAgent: string | undefined,
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, lead: { id: leadId } },
      relations: { documentType: true, lead: true },
    });
    if (!document) {
      throw new NotFoundException(
        `Document ${documentId} not found for lead ${leadId}`,
      );
    }

    const log = this.documentDownloadLogRepository.create({
      document,
      lead: document.lead,
      user: await this.userRepository.findOne({ where: { id: actingUserId } }),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      createdAt: new Date(),
    });
    await this.documentDownloadLogRepository.save(log);

    return document;
  }

  async removeDocument(leadId: number, documentId: number): Promise<void> {
    const lead = await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { leadStatus: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    assertLeadEditableBySupport(lead);

    const document = await this.documentRepository.findOne({
      where: { id: documentId, lead: { id: leadId } },
    });
    if (!document) {
      throw new NotFoundException(
        `Document ${documentId} not found for lead ${leadId}`,
      );
    }
    document.isActive = false;
    document.isDeleted = true;
    await this.documentRepository.save(document);
  }
}
