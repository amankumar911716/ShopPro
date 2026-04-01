import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AppContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import axios from 'axios';
import { Search, Users, Shield, User } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AdminUsers = () => {

  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {

      setLoading(true);

      const res = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUsers(res.data);

    } catch (error) {

      toast.error("Failed to fetch users");

    } finally {

      setLoading(false);

    }
  };

  const handleRoleChange = async (userId, newRole) => {

    if (userId === currentUser?.id) {

      toast.error("You cannot change your own role");
      return;

    }

    try {

      await axios.put(
        `${API}/admin/users/${userId}/role?role=${newRole}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("User role updated");
      fetchUsers();

    } catch (error) {

      toast.error("Failed to update role");

    }
  };

  const deleteUser = async (userId) => {

    if (userId === currentUser?.id) {

      toast.error("You cannot delete yourself");
      return;

    }

    if (!window.confirm("Delete this user?")) return;

    try {

      await axios.delete(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("User deleted");
      fetchUsers();

    } catch (error) {

      toast.error("Delete failed");

    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8">

      <div className="flex justify-between mb-6">

        <div>

          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">{users.length} users total</p>

        </div>

      </div>

      <Card>

        <CardHeader>

          <div className="relative w-full max-w-sm">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />

          </div>

        </CardHeader>

        <CardContent className="p-0">

          {loading ? (

            <div className="p-6 space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>

          ) : filteredUsers.length === 0 ? (

            <div className="text-center py-12">

              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />

              <p className="text-muted-foreground">No users found</p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <Table>

                <TableHeader>

                  <TableRow>

                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>

                  </TableRow>

                </TableHeader>

                <TableBody>

                  {filteredUsers.map((user) => (

                    <TableRow key={user.id}>

                      <TableCell>

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">

                            {user.role === 'admin'
                              ? <Shield className="h-5 w-5 text-accent" />
                              : <User className="h-5 w-5 text-muted-foreground" />}

                          </div>

                          <span className="font-medium">{user.name}</span>

                        </div>

                      </TableCell>

                      <TableCell>{user.email}</TableCell>

                      <TableCell>{user.phone || "-"}</TableCell>

                      <TableCell>

                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? "Admin" : "User"}
                        </Badge>

                      </TableCell>

                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>

                      <TableCell className="text-right">

                        <div className="flex gap-2 justify-end">

                          <Select
                            value={user.role}
                            onValueChange={(v) => handleRoleChange(user.id, v)}
                            disabled={user.id === currentUser?.id}
                          >

                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>

                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>

                            </SelectContent>

                          </Select>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteUser(user.id)}
                            disabled={user.id === currentUser?.id}
                          >
                            Delete
                          </Button>

                        </div>

                      </TableCell>

                    </TableRow>

                  ))}

                </TableBody>

              </Table>

            </div>

          )}

        </CardContent>

      </Card>

    </div>
  );
};

export default AdminUsers;