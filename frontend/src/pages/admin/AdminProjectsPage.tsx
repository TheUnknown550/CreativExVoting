import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
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
  message,
} from 'antd';
import { useDeferredValue, useEffect, useState } from 'react';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
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

  async function loadCategories() {
    if (!token) {
      return;
    }

    try {
      setCategories(await adminApi.getAdminCategories(token));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load categories.');
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
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load projects.');
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
      messageApi.success(`Project ${editingProject ? 'updated' : 'created'} successfully.`);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to save project.');
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
      messageApi.success('Project deactivated.');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to deactivate project.');
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <Typography.Title className="page-title" level={1}>
            Project Management
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            Curate every nominated project, enrich its judging details, and keep active entries ready
            for assigned judges.
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="table-toolbar">
            <div className="table-toolbar__filters">
              <Input
                placeholder="Search by title, team, or designer"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 320 }}
              />
              <Select
                allowClear
                placeholder="Filter by category"
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value)}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                style={{ width: 220 }}
              />
            </div>

            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              New Project
            </Button>
          </div>

          <Table<Project>
            rowKey="id"
            loading={loading}
            dataSource={projects}
            scroll={{ x: 1020 }}
            columns={[
              { title: 'Title', dataIndex: 'title', fixed: 'left', width: 240 },
              { title: 'Category', dataIndex: 'category_name', width: 180 },
              {
                title: 'Designer / Team',
                width: 220,
                render: (_, record) => record.designer_name || record.team_name || 'Not provided',
              },
              {
                title: 'Short Description',
                dataIndex: 'short_description',
                width: 320,
                render: (value: string) => value || 'No short description',
              },
              {
                title: 'Status',
                dataIndex: 'is_active',
                width: 120,
                render: (value: boolean) =>
                  value ? <Typography.Text style={{ color: '#4f7a57' }}>Active</Typography.Text> : 'Inactive',
              },
              {
                title: 'Actions',
                fixed: 'right',
                width: 190,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                      Edit
                    </Button>
                    <Popconfirm title="Deactivate this project?" onConfirm={() => void handleDelete(record.id)}>
                      <Button danger icon={<DeleteOutlined />}>
                        Deactivate
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
        title={editingProject ? 'Edit Project' : 'Create Project'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
        width={840}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={blankProject}>
          <Form.Item name="category_id" label="Category" rules={[{ required: true }]}>
            <Select options={categories.map((category) => ({ value: category.id, label: category.name }))} />
          </Form.Item>
          <Form.Item name="title" label="Project Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="short_description" label="Short Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="full_description" label="Full Description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="concept" label="Concept">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="designer_name" label="Designer Name">
            <Input />
          </Form.Item>
          <Form.Item name="team_name" label="Team Name">
            <Input />
          </Form.Item>
          <Form.Item name="image_url" label="Image URL">
            <Input />
          </Form.Item>
          <Form.Item name="proposal_link" label="Proposal Link">
            <Input />
          </Form.Item>
          <Form.Item name="social_media_link" label="Social Media Link">
            <Input />
          </Form.Item>
          <Form.Item name="drive_link" label="Google Drive / More Info Link">
            <Input />
          </Form.Item>
          <Form.Item name="attached_file_link" label="Attached File Link">
            <Input />
          </Form.Item>
          <Form.Item name="extra_details" label="Extra Details">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
