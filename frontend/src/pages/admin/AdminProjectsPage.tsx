import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  Upload,
  message,
} from 'antd';
import { useDeferredValue, useEffect, useState } from 'react';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Category, Project, ProjectPayload } from '../../types/domain';

const blankProject: ProjectPayload = {
  category_id: '',
  title: '',
  short_description: '',
  full_description: '',
  concept: '',
  designer_name: '',
  team_name: '',
  image_url: '',
  proposal_link: '',
  social_media_link: '',
  drive_link: '',
  attached_file_link: '',
  extra_details: '',
  is_active: true,
};

export function AdminProjectsPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [form] = Form.useForm<ProjectPayload>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [categoryFilter, setCategoryFilter] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageUrl = Form.useWatch('image_url', form);

  async function loadCategories() {
    if (!token) {
      return;
    }

    try {
      setCategories(await adminApi.getAdminCategories(token));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminProjects.loadCategoriesError'));
    }
  }

  async function loadProjects() {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      setProjects(await adminApi.getAdminProjects(token, categoryFilter, deferredSearch));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminProjects.loadProjectsError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [token]);

  useEffect(() => {
    void loadProjects();
  }, [token, categoryFilter, deferredSearch]);

  function openCreateModal() {
    setEditingProject(null);
    form.setFieldsValue(blankProject);
    setModalOpen(true);
  }

  function openEditModal(project: Project) {
    setEditingProject(project);
    form.setFieldsValue({
      category_id: project.category_id,
      title: project.title,
      short_description: project.short_description,
      full_description: project.full_description,
      concept: project.concept,
      designer_name: project.designer_name,
      team_name: project.team_name,
      image_url: project.image_url,
      proposal_link: project.proposal_link,
      social_media_link: project.social_media_link,
      drive_link: project.drive_link,
      attached_file_link: project.attached_file_link,
      extra_details: project.extra_details,
      is_active: project.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(values: ProjectPayload) {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      if (editingProject) {
        await adminApi.updateProject(token, editingProject.id, values);
      } else {
        await adminApi.createProject(token, values);
      }
      setModalOpen(false);
      await loadProjects();
      messageApi.success(
        t('adminProjects.savedSuccess', {
          action: editingProject ? t('adminProjects.updated') : t('adminProjects.created'),
        }),
      );
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminProjects.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) {
      return;
    }
    try {
      await adminApi.deleteProject(token, id);
      await loadProjects();
      messageApi.success(t('adminProjects.deactivatedSuccess'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminProjects.deactivateError'));
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="soft-card">
          <div className="table-toolbar">
            <div className="table-toolbar__filters">
              <Input
                placeholder={t('adminProjects.searchPlaceholder')}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 320 }}
              />
              <Select
                allowClear
                placeholder={t('adminProjects.filterByCategory')}
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value)}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                style={{ width: 220 }}
              />
            </div>

            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('adminProjects.newProject')}
            </Button>
          </div>

          <Table<Project>
            rowKey="id"
            loading={loading}
            dataSource={projects}
            scroll={{ x: 1020 }}
            columns={[
              { title: t('adminProjects.title_col'), dataIndex: 'title', fixed: 'left', width: 240 },
              { title: t('adminProjects.category'), dataIndex: 'category_name', width: 180 },
              {
                title: t('adminProjects.designerTeam'),
                width: 220,
                render: (_, record) => record.designer_name || record.team_name || t('common.notProvided'),
              },
              {
                title: t('adminProjects.shortDescription'),
                dataIndex: 'short_description',
                width: 320,
                render: (value: string) => value || t('adminProjects.noShortDescription'),
              },
              {
                title: t('common.status'),
                dataIndex: 'is_active',
                width: 120,
                render: (value: boolean) =>
                  value ? (
                    <Typography.Text style={{ color: '#4f7a57' }}>{t('common.active')}</Typography.Text>
                  ) : (
                    t('common.inactive')
                  ),
              },
              {
                title: t('common.actions'),
                fixed: 'right',
                width: 190,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                      {t('common.edit')}
                    </Button>
                    <Popconfirm
                      title={t('adminProjects.deactivateConfirm')}
                      onConfirm={() => void handleDelete(record.id)}
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        {t('common.deactivate')}
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        title={editingProject ? t('adminProjects.editProject') : t('adminProjects.createProject')}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
        width={840}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={blankProject}>
          <Form.Item name="category_id" label={t('adminProjects.category')} rules={[{ required: true }]}>
            <Select options={categories.map((category) => ({ value: category.id, label: category.name }))} />
          </Form.Item>
          <Form.Item name="title" label={t('adminProjects.projectTitle')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="short_description" label={t('adminProjects.shortDescriptionLabel')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="full_description" label={t('adminProjects.fullDescription')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="concept" label={t('adminProjects.concept')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="designer_name" label={t('adminProjects.designerName')}>
            <Input />
          </Form.Item>
          <Form.Item name="team_name" label={t('adminProjects.teamName')}>
            <Input />
          </Form.Item>
          <Form.Item label={t('adminProjects.image')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  style={{ maxHeight: 150, borderRadius: 8, border: '1px solid var(--ce-border)' }}
                />
              ) : null}
              <Space>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  customRequest={async ({ file, onSuccess, onError }) => {
                    if (!token) {
                      return;
                    }
                    setUploadingImage(true);
                    try {
                      const { url } = await adminApi.uploadProjectImage(token, file as File);
                      form.setFieldValue('image_url', url);
                      messageApi.success(t('adminProjects.imageUploaded'));
                      onSuccess?.({});
                    } catch (error) {
                      messageApi.error(error instanceof ApiError ? error.message : t('adminProjects.imageUploadError'));
                      onError?.(error as Error);
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingImage}>
                    {t('adminProjects.uploadImage')}
                  </Button>
                </Upload>
                {imageUrl ? (
                  <Button type="text" danger onClick={() => form.setFieldValue('image_url', '')}>
                    {t('adminProjects.removeImage')}
                  </Button>
                ) : null}
              </Space>
              <Form.Item name="image_url" noStyle>
                <Input placeholder={t('adminProjects.imageUrlPlaceholder')} />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="proposal_link" label={t('adminProjects.proposalLink')}>
            <Input />
          </Form.Item>
          <Form.Item name="social_media_link" label={t('adminProjects.socialMediaLink')}>
            <Input />
          </Form.Item>
          <Form.Item name="drive_link" label={t('adminProjects.driveLink')}>
            <Input />
          </Form.Item>
          <Form.Item name="attached_file_link" label={t('adminProjects.attachedFileLink')}>
            <Input />
          </Form.Item>
          <Form.Item name="extra_details" label={t('adminProjects.extraDetails')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="is_active" label={t('common.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
