import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
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
import { useEffect, useState } from 'react';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { AwardGroup, JudgePayload, User } from '../../types/domain';

const blankJudge: JudgePayload = {
  username: '',
  display_name: '',
  password: '',
  role: 'judge',
  is_active: true,
  group_ids: [],
};

export function AdminJudgesPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [form] = Form.useForm<JudgePayload>();
  const [passwordForm] = Form.useForm<{ password: string }>();
  const [groups, setGroups] = useState<AwardGroup[]>([]);
  const [judges, setJudges] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadPageData() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [nextJudges, nextGroups] = await Promise.all([
        adminApi.getAdminJudges(token),
        adminApi.getAdminGroups(token),
      ]);
      setJudges(nextJudges);
      setGroups(nextGroups);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminJudges.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, [token]);

  function openCreateModal() {
    setEditingJudge(null);
    form.setFieldsValue(blankJudge);
    setModalOpen(true);
  }

  async function openEditModal(judge: User) {
    if (!token) {
      return;
    }

    setEditingJudge(judge);
    try {
      const groupIds = await adminApi.getJudgeAssignments(token, judge.id);
      form.setFieldsValue({
        username: judge.username,
        display_name: judge.display_name,
        role: judge.role,
        is_active: judge.is_active,
        group_ids: groupIds,
      });
      setModalOpen(true);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminJudges.loadAssignmentsError'));
    }
  }

  async function handleSubmit(values: JudgePayload) {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      if (editingJudge) {
        await adminApi.updateJudge(token, editingJudge.id, {
          ...values,
          password: undefined,
        });
      } else {
        await adminApi.createJudge(token, values);
      }
      setModalOpen(false);
      await loadPageData();
      messageApi.success(
        t('adminJudges.savedSuccess', {
          action: editingJudge ? t('adminJudges.updated') : t('adminJudges.created'),
        }),
      );
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminJudges.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) {
      return;
    }
    try {
      await adminApi.deleteJudge(token, id);
      await loadPageData();
      messageApi.success(t('adminJudges.deactivatedSuccess'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminJudges.deactivateError'));
    }
  }

  async function handleResetPassword(values: { password: string }) {
    if (!token || !editingJudge) {
      return;
    }
    setSaving(true);
    try {
      await adminApi.resetJudgePassword(token, editingJudge.id, values.password);
      setPasswordModalOpen(false);
      passwordForm.resetFields();
      messageApi.success(t('adminJudges.resetPasswordSuccess'));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : t('adminJudges.resetPasswordError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="soft-card">
          <div className="table-toolbar">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t('adminJudges.judgesAndAdmins')}
            </Typography.Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('adminJudges.newUser')}
            </Button>
          </div>

          <Table<User>
            rowKey="id"
            loading={loading}
            dataSource={judges}
            pagination={false}
            columns={[
              { title: t('adminJudges.displayName'), dataIndex: 'display_name' },
              { title: t('adminJudges.username'), dataIndex: 'username' },
              { title: t('adminJudges.role'), dataIndex: 'role', width: 120 },
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
                width: 260,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => void openEditModal(record)}>
                      {t('common.edit')}
                    </Button>
                    <Button
                      icon={<KeyOutlined />}
                      onClick={() => {
                        setEditingJudge(record);
                        setPasswordModalOpen(true);
                      }}
                    >
                      {t('adminJudges.resetPassword')}
                    </Button>
                    <Popconfirm
                      title={t('adminJudges.deactivateConfirm')}
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
        title={editingJudge ? t('adminJudges.editUser') : t('adminJudges.createUser')}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={blankJudge}>
          <Form.Item name="username" label={t('adminJudges.username')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label={t('adminJudges.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editingJudge ? (
            <Form.Item name="password" label={t('adminJudges.password')} rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item name="role" label={t('adminJudges.role')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'judge', label: t('adminJudges.judgeRole') },
                { value: 'admin', label: t('adminJudges.adminRole') },
              ]}
            />
          </Form.Item>
          <Form.Item name="group_ids" label={t('adminJudges.assignedGroups')}>
            <Select
              mode="multiple"
              options={groups.map((group) => ({ value: group.id, label: group.name }))}
            />
          </Form.Item>
          <Form.Item name="is_active" label={t('common.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={passwordModalOpen}
        title={`${t('adminJudges.resetPassword')}${editingJudge ? `: ${editingJudge.display_name}` : ''}`}
        onCancel={() => setPasswordModalOpen(false)}
        onOk={() => void passwordForm.submit()}
        confirmLoading={saving}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item name="password" label={t('adminJudges.newPassword')} rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
