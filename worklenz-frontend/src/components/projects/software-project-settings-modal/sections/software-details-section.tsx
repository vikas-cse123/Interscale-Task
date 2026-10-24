import { useTranslation } from 'react-i18next';
import { Col, ColorPicker, Flex, Form, FormInstance, Input, Row } from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import ProjectStatusSection from '../../project-drawer/project-status-section/project-status-section';
import ProjectHealthSection from '../../project-drawer/project-health-section/project-health-section';
import ProjectPrioritySection from '../../project-drawer/project-priority-section/project-priority-section';
import ProjectCategorySection from '../../project-drawer/project-category-section/project-category-section';
import ProjectClientSection from '../../project-drawer/project-client-section/project-client-section';
import SettingsCard from '../../project-settings-modal/components/settings-card';
import { SectionHeader } from '../components/section-header';
import TimelineEstimatesCard from '../../project-settings-modal/sections/TimelineEstimatesCard';
import { useProjectDateSync } from '../../project-settings-modal/hooks/useProjectDateSync';
import DeliveryConfidenceSettingsSection from '../../project-settings-modal/sections/delivery-confidence-settings-section';

interface SoftwareDetailsSectionProps {
  form: FormInstance;
  project: IProjectViewModel | null;
  disabled: boolean;
  isFreePlan: boolean;
}

export const SoftwareDetailsSection = ({
  form,
  project,
  disabled,
  isFreePlan,
}: SoftwareDetailsSectionProps) => {
  const { t } = useTranslation('project-drawer');
  const { projectStatuses } = useAppSelector(state => state.projectStatusesReducer);
  const { projectHealths } = useAppSelector(state => state.projectHealthReducer);
  const { priorities } = useAppSelector(state => state.projectPriorityReducer);
  const { clients, loading: isLoadingClients } = useAppSelector(state => state.clientReducer);

  const keyPreview = (Form.useWatch('key', form) as string | undefined)?.trim().toUpperCase();

  const dateSync = useProjectDateSync(form, project?.id ?? null);

  return (
    <Flex vertical gap={16}>
      <SectionHeader
        title={t('softwareSettings.detailsTitle', { defaultValue: 'Project details' })}
        description={t('softwareSettings.detailsDescription', {
          defaultValue: 'Name, key and description your team sees across the project.',
        })}
      />

      <SettingsCard title={t('softwareSettings.identityCard', { defaultValue: 'Identity' })}>
        <Row gutter={12}>
          <Col xs={24} md={16}>
            <Form.Item
              name="name"
              label={t('name')}
              rules={[{ required: true, message: t('pleaseEnterAName') }]}
            >
              <Input placeholder={t('enterProjectName')} disabled={disabled} maxLength={100} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="key"
              label={t('softwareSettings.projectKey', { defaultValue: 'Project key' })}
              normalize={(value: string) => value?.toUpperCase()}
              rules={[
                {
                  required: true,
                  message: t('softwareSettings.projectKeyRequired', {
                    defaultValue: 'Enter a project key',
                  }),
                },
                {
                  pattern: /^[A-Z0-9_-]+$/,
                  message: t('softwareSettings.projectKeyInvalid', {
                    defaultValue: 'Use letters, numbers, hyphens or underscores only',
                  }),
                },
              ]}
              extra={t('softwareSettings.projectKeyHelp', {
                defaultValue: 'Work items are numbered {{example}}',
                example: `${keyPreview || 'KEY'}-12`,
              })}
            >
              <Input placeholder="KEY" disabled={disabled} maxLength={10} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="notes"
          label={t('softwareSettings.description', { defaultValue: 'Description' })}
        >
          <Input.TextArea
            placeholder={t('softwareSettings.descriptionPlaceholder', {
              defaultValue: 'What is this product or service about?',
            })}
            disabled={disabled}
            maxLength={500}
            showCount
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>

        <Form.Item
          name="color_code"
          label={t('projectColor')}
          layout="horizontal"
          getValueFromEvent={(color: { toHexString: () => string }) => color.toHexString()}
          style={{ marginBottom: 0 }}
        >
          <ColorPicker disabled={disabled} disabledAlpha aria-label={t('projectColor')} />
        </Form.Item>
      </SettingsCard>

      <SettingsCard
        title={t('softwareSettings.trackingCard', { defaultValue: 'Status & tracking' })}
      >
        <ProjectStatusSection statuses={projectStatuses} form={form} t={t} disabled={disabled} />
        <ProjectHealthSection
          healths={projectHealths}
          form={form}
          t={t}
          disabled={isFreePlan || disabled}
        />
        <ProjectPrioritySection priorities={priorities} form={form} t={t} disabled={disabled} />
        <ProjectCategorySection form={form} t={t} disabled={isFreePlan || disabled} />
        <DeliveryConfidenceSettingsSection form={form} t={t} disabled={disabled} />
        <ProjectClientSection
          clients={clients}
          form={form}
          t={t}
          project={project}
          loadingClients={isLoadingClients}
          disabled={disabled}
        />
      </SettingsCard>

      <TimelineEstimatesCard
        form={form}
        disabled={disabled}
        disabledStartDate={dateSync.disabledStartDate}
        disabledEndDate={dateSync.disabledEndDate}
        onStartDateChange={dateSync.handleStartDateChange}
        onEndDateChange={dateSync.handleEndDateChange}
      />
    </Flex>
  );
};
